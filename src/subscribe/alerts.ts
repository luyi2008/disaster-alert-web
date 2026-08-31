import { escapeHtml } from "./html";
import { parseApiResponse } from "./http";
import { mergeAlertsByCategory } from "./mergeAlerts";
import { animateHeight } from "./motion";
import type { SubscribeRuntime } from "./runtime";
import type {
  AlertEntry,
  AlertRuleDraft,
  CategoryOption,
  IntensityBand,
  NotifyLevel,
  SubscriptionDraft,
  ToastType,
} from "./types";

const notifyLevelOrder: NotifyLevel[] = ["passive", "active", "critical"];

export type AlertController = {
  loadSubscriptionOptions: (
    draft: SubscriptionDraft,
    generation: number,
    mergeOptions: { missingEnabled: boolean },
  ) => Promise<void>;
  renderDisasterGroups: () => void;
  validateAlertRules: () => string;
  enabledAlertRules: () => AlertRuleDraft[];
  alertRuleForPayload: (rule: AlertRuleDraft) => AlertRuleDraft;
  alertEntry: (category: string) => AlertEntry | null;
  commitBands: (showWarning?: boolean) => boolean;
};

export function bindAlertRules(
  ctx: SubscribeRuntime,
  helpers: {
    persistDraft: () => void;
    show: (message: string, type?: ToastType) => void;
  },
): AlertController {
  function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  function sourceIds(category: string): string[] {
    const option = ctx.optionCategories.find((item) => item.id === category);
    return (option?.source_groups || []).flatMap((group) => group.sources.map((source) => source.id));
  }

  function alertEntry(category: string): AlertEntry | null {
    return ctx.subscriptionDraft.alerts_by_category[category] || null;
  }

  function alertRule(category: string): AlertRuleDraft | null {
    return alertEntry(category)?.rule || null;
  }

  function enabledAlertRules(): AlertRuleDraft[] {
    return Object.values(ctx.subscriptionDraft.alerts_by_category)
      .filter((entry) => entry.enabled)
      .map((entry) => entry.rule);
  }

  function alertRuleForPayload(rule: AlertRuleDraft): AlertRuleDraft {
    const result = cloneJson(rule);
    if (result.category === "earthquake_report") result.min_magnitude = Number(result.min_magnitude);
    if (result.category === "weather_warning") {
      result.min_severity = Number(result.min_severity);
      result.fallback_radius_km = Number(result.fallback_radius_km);
    }
    if (result.category === "tsunami") result.min_severity = Number(result.min_severity);
    if (result.category === "typhoon") result.max_center_distance_km = Number(result.max_center_distance_km);
    return result;
  }

  function intensityBands(): IntensityBand[] {
    return alertRule("earthquake_warning")?.estimated_intensity_bands || [];
  }

  function sourceEnabled(category: string, source: string): boolean {
    const selection = alertRule(category)?.sources;
    return selection?.mode === "all"
      || Boolean(selection?.mode === "include" && Array.isArray(selection.ids) && selection.ids.includes(source));
  }

  function setSelectedSources(category: string, ids: string[]): void {
    const allIds = sourceIds(category);
    const selected = allIds.filter((id) => Array.isArray(ids) && ids.includes(id));
    const rule = alertRule(category);
    if (!rule) return;
    rule.sources = selected.length === allIds.length
      ? { mode: "all" }
      : { mode: "include", ids: selected };
  }

  function defaultNotifyBands(): Array<{ min: number; max: number; level: NotifyLevel; label: string }> {
    return [
      { min: 1, max: 1, level: "passive", label: "低烈度" },
      { min: 2, max: 2, level: "active", label: "中等烈度" },
      { min: 3, max: 7, level: "critical", label: "高烈度" },
    ];
  }

  function levelLabel(level: string): string {
    return level === "critical" ? "Critical" : level === "active" ? "Active" : "Passive";
  }

  function clampInt(value: unknown, min: number, max: number, fallback: number): number {
    const number = Number.parseInt(String(value), 10);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function normalizeBands(bands: IntensityBand[] | undefined): Array<{ min: number; max: number; level: NotifyLevel; label: string }> {
    const result: Array<{ min: number; max: number; level: NotifyLevel; label: string }> = [];
    const usedLevels = new Set<string>();
    for (const band of bands || []) {
      const levelValue = band.interruption_level ?? band.level;
      const level = notifyLevelOrder.includes(String(levelValue || "").toLowerCase() as NotifyLevel)
        ? String(levelValue).toLowerCase() as NotifyLevel
        : "passive";
      if (usedLevels.has(level)) continue;
      usedLevels.add(level);
      const min = clampInt(band.min, 0, 7, 0);
      const max = clampInt(band.max, 0, 7, level === "critical" ? 7 : min);
      result.push({ min, max, level, label: String(band.label || levelLabel(level)).trim() });
      if (result.length >= 3) break;
    }
    return result.length ? result.sort((a, b) => a.min - b.min) : defaultNotifyBands();
  }

  function sanitizeAlertRule(category: CategoryOption, candidate: AlertRuleDraft | undefined): AlertRuleDraft {
    const fallback = cloneJson(category.default_alert);
    if (!candidate || typeof candidate !== "object" || candidate.category !== category.id) return fallback;
    const knownSources = new Set(sourceIds(category.id));
    const selection = candidate.sources;
    if (selection?.mode === "all") {
      fallback.sources = { mode: "all" };
    } else if (selection?.mode === "include" && Array.isArray(selection.ids)) {
      fallback.sources = {
        mode: "include",
        ids: [...new Set(selection.ids.filter((id) => typeof id === "string" && knownSources.has(id)))],
      };
    }
    const numberInRange = (value: unknown, defaultValue: number | string | undefined, min: number, max: number, integer = false) => {
      if ((typeof value !== "number" && typeof value !== "string")
        || (typeof value === "string" && !value.trim())) return defaultValue;
      const number = Number(value);
      return Number.isFinite(number) && number >= min && number <= max && (!integer || Number.isInteger(number))
        ? number
        : defaultValue;
    };
    if (category.id === "earthquake_warning") {
      fallback.estimated_intensity_bands = normalizeBands(candidate.estimated_intensity_bands)
        .map((band) => ({ min: band.min, max: band.max, interruption_level: band.level }));
    } else if (category.id === "earthquake_report") {
      fallback.min_magnitude = numberInRange(candidate.min_magnitude, fallback.min_magnitude, 0, 10);
    } else if (category.id === "weather_warning") {
      fallback.min_severity = numberInRange(candidate.min_severity, fallback.min_severity, 1, 4, true);
      fallback.fallback_radius_km = numberInRange(candidate.fallback_radius_km, fallback.fallback_radius_km, 1, 2000);
    } else if (category.id === "tsunami") {
      fallback.min_severity = numberInRange(candidate.min_severity, fallback.min_severity, 1, 4, true);
    } else if (category.id === "typhoon") {
      fallback.max_center_distance_km = numberInRange(candidate.max_center_distance_km, fallback.max_center_distance_km, 1, 3000);
    }
    return fallback;
  }

  function levelOptions(selected: unknown): string {
    return ([[1, "蓝色/信息"], [2, "黄色"], [3, "橙色"], [4, "红色"]] as const)
      .map(([value, label]) => `<option value="${value}" ${Number(selected) === value ? "selected" : ""}>${label}</option>`)
      .join("");
  }

  function severityLabel(value: unknown): string {
    return ({ 1: "蓝色/信息", 2: "黄色", 3: "橙色", 4: "红色" } as Record<number, string>)[Number(value)] || `级别 ${value}`;
  }

  function thresholdFields(category: string, disabled: boolean): string {
    const state = disabled ? "disabled" : "";
    const alert: AlertRuleDraft = alertRule(category) || ctx.optionCategories.find((item) => item.id === category)?.default_alert || { category };
    if (category === "earthquake_report") return `
    <label class="rule-field">
      <span class="rule-field-title">最低震级</span>
      <input data-rule="min_magnitude" type="number" min="0" max="10" step="0.1" value="${escapeHtml(alert.min_magnitude)}" ${state}>
      <small>仅筛选地震信息，不影响地震预警。</small>
    </label>`;
    if (category === "weather_warning") return `
    <label class="rule-field">
      <span class="rule-field-title">最低严重度</span>
      <select data-rule="min_severity" ${state}>${levelOptions(alert.min_severity)}</select>
      <small>低于此级别的气象预警不推送。</small>
    </label>
    <label class="rule-field">
      <span class="rule-field-title">坐标回退半径</span>
      <input data-rule="fallback_radius_km" type="number" min="1" max="2000" step="1" value="${escapeHtml(alert.fallback_radius_km)}" ${state}>
      <small>行政区未命中时，按地点周边公里数匹配。</small>
    </label>`;
    if (category === "tsunami") return `
    <label class="rule-field">
      <span class="rule-field-title">最低严重度</span>
      <select data-rule="min_severity" ${state}>${levelOptions(alert.min_severity)}</select>
      <small>结合监测地点的行政区进行匹配。</small>
    </label>`;
    if (category === "typhoon") return `
    <label class="rule-field">
      <span class="rule-field-title">中心最大距离</span>
      <input data-rule="max_center_distance_km" type="number" min="1" max="3000" step="1" value="${escapeHtml(alert.max_center_distance_km)}" ${state}>
      <small>台风中心距离任一监测地点不超过此公里数。</small>
    </label>`;
    return "";
  }

  function categoryRuleSummary(category: string): string {
    const alert = alertRule(category);
    if (!alert || !alertEntry(category)?.enabled) return "";
    if (category === "earthquake_warning") return `${intensityBands().length} 段烈度规则`;
    if (category === "earthquake_report") return `M ≥ ${Number(alert.min_magnitude).toFixed(1)}`;
    if (category === "weather_warning") return `≥ ${severityLabel(alert.min_severity)} · 回退 ${Number(alert.fallback_radius_km)} km`;
    if (category === "tsunami") return `≥ ${severityLabel(alert.min_severity)}`;
    if (category === "typhoon") return `中心 ${Number(alert.max_center_distance_km)} km 内`;
    return "";
  }

  function intensityRuleEditor(disabled: boolean): string {
    const state = disabled ? "disabled" : "";
    return `
    <div class="rule-section">
      <div class="rule-section-header">
        <span class="rule-section-title">通知规则</span>
        <span class="intensity-actions">
          <button type="button" data-intensity-action="add" ${state}>添加规则</button>
          <button type="button" data-intensity-action="reset" ${state}>恢复默认</button>
        </span>
      </div>
      <small>按预估烈度决定通知级别，未包含在规则中的烈度不会推送。</small>
      <div id="notify-bands" class="intensity-rules"></div>
      <div id="notify-warning" class="notify-warning"></div>
    </div>`;
  }

  function setNotifyWarning(message = ""): void {
    if (!ctx.notifyWarning) return;
    ctx.notifyWarning.textContent = message;
    ctx.notifyWarning.classList.toggle("show", Boolean(message));
  }

  function validateBands(bands: Array<{ min: number; max: number; level: string; label: string }>): string {
    if (!bands.length) return "请至少保留一条通知级别规则";
    const levels = new Set<string>();
    const used = new Set<number>();
    for (const band of bands) {
      if (!notifyLevelOrder.includes(band.level as NotifyLevel)) return "通知级别无效";
      if (levels.has(band.level)) return "每个通知级别只能添加一条规则";
      levels.add(band.level);
      if (!Number.isInteger(band.min) || !Number.isInteger(band.max) || band.min > band.max || band.min < 0 || band.max > 7) return "烈度范围无效";
      if (band.level === "critical" && band.max !== 7) return "Critical 规则上限必须覆盖烈度 7";
      if (String(band.label || "").trim().length > 32) return "通知级别标签最多 32 个字符";
      for (let value = band.min; value <= band.max; value++) {
        if (used.has(value)) return "烈度范围不能重叠";
        used.add(value);
      }
    }
    return "";
  }

  function renderNotifyBands(): void {
    if (!ctx.notifyBandsEl) return;
    const bands = intensityBands().map((band) => ({
      min: band.min ?? "",
      max: band.max ?? "",
      level: String(band.interruption_level ?? band.level ?? "passive").toLowerCase(),
    }));
    const state = alertEntry("earthquake_warning")?.enabled ? "" : "disabled";
    ctx.notifyBandsEl.innerHTML = bands.map((band, index) => `
    <div class="intensity-rule" data-index="${escapeHtml(index)}">
      <div class="intensity-rule-header">
        <span class="intensity-rule-name">规则 ${escapeHtml(index + 1)}</span>
      </div>
      <div class="intensity-rule-fields">
        <label class="rule-field">
          <span class="rule-field-title">预估烈度范围</span>
          <span class="intensity-range">
            <input class="band-min" type="number" min="0" max="7" step="1" value="${escapeHtml(band.min)}" aria-label="起始烈度" ${state}>
            <span>至</span>
            <input class="band-max" type="number" min="0" max="7" step="1" value="${escapeHtml(band.max)}" aria-label="最高烈度" ${state}>
          </span>
        </label>
        <label class="rule-field">
          <span class="rule-field-title">通知级别</span>
          <select class="band-select level-${escapeHtml(band.level)}" ${state}>
            ${notifyLevelOrder.map((level) => `<option value="${escapeHtml(level)}" ${level === band.level ? "selected" : ""}>${escapeHtml(levelLabel(level))}</option>`).join("")}
          </select>
        </label>
      </div>
      <button class="remove-intensity-rule" type="button" data-action="remove-rule" aria-label="删除规则 ${escapeHtml(index + 1)}" title="删除规则" ${state}>×</button>
    </div>
  `).join("");
  }

  function collectBands(): Array<{ min: number; max: number; level: string; label: string }> {
    return intensityBands().map((band) => {
      const level = String(band.interruption_level ?? band.level ?? "").toLowerCase();
      const minRaw = String(band.min ?? "").trim();
      const maxRaw = String(band.max ?? "").trim();
      const min = minRaw ? Number(minRaw) : NaN;
      const max = maxRaw ? Number(maxRaw) : NaN;
      return { min, max, level, label: levelLabel(level) };
    });
  }

  function updateBandDraft(control: HTMLElement): void {
    const row = control.closest(".intensity-rule");
    const band = intensityBands()[Number((row as HTMLElement | null)?.dataset.index)];
    if (!band) return;
    if (control.classList.contains("band-min") && control instanceof HTMLInputElement) band.min = control.value;
    if (control.classList.contains("band-max") && control instanceof HTMLInputElement) band.max = control.value;
    if (control.classList.contains("band-select") && control instanceof HTMLSelectElement) band.interruption_level = control.value;
    setNotifyWarning(validateBands(collectBands()));
    helpers.persistDraft();
  }

  function commitBands(showWarning = false): boolean {
    const bands = collectBands();
    const error = validateBands(bands);
    setNotifyWarning(error || "");
    if (error) return false;
    const rule = alertRule("earthquake_warning");
    if (rule) {
      rule.estimated_intensity_bands = bands.sort((left, right) => left.min - right.min).map((band) => ({
        min: band.min, max: band.max, interruption_level: band.level,
      }));
    }
    renderNotifyBands();
    if (showWarning && !error) helpers.persistDraft();
    return true;
  }

  function renderDisasterGroups(): void {
    ctx.el.disasterGroupsEl.innerHTML = ctx.optionCategories.map((category) => {
      const disabled = !alertEntry(category.id)?.enabled;
      const sourceCount = category.source_groups.reduce((total, group) => total + group.sources.length, 0);
      const enabledCount = category.source_groups.reduce((total, group) => total + group.sources.filter((source) => sourceEnabled(category.id, source.id)).length, 0);
      const expanded = ctx.expandedDisasterCategories.has(category.id);
      const filters = thresholdFields(category.id, disabled);
      const sourceMode = alertRule(category.id)?.sources?.mode;
      const sourceSummary = sourceMode === "all" ? `全部 ${sourceCount} 个来源` : `已选 ${enabledCount}/${sourceCount} 个来源`;
      const ruleSummary = categoryRuleSummary(category.id);
      return `
    <section class="disaster-category ${disabled ? "is-disabled" : ""}" data-category-card="${escapeHtml(category.id)}">
      <div class="disaster-category-header">
        <button class="category-expand" type="button" data-expand-category="${escapeHtml(category.id)}" aria-expanded="${expanded}">
          <span class="category-chevron">›</span>
          <span class="category-copy">
            <span class="category-title">${escapeHtml(category.label)}</span>
            <span class="category-meta">${disabled ? "已关闭" : `${escapeHtml(sourceSummary)}${ruleSummary ? ` · ${escapeHtml(ruleSummary)}` : ""}`}</span>
          </span>
        </button>
        <label class="switch" aria-label="${escapeHtml(disabled ? `启用${category.label}` : `停用${category.label}`)}">
          <input class="category-toggle" data-category="${escapeHtml(category.id)}" type="checkbox" ${disabled ? "" : "checked"}>
          <span class="switch-track"></span>
        </label>
      </div>
      <div class="disaster-detail" ${expanded ? "" : "hidden"}>
        <div class="source-overview">
          ${category.source_groups.map((group) => `
            <div class="source-section" data-source-group="${escapeHtml(group.id)}">
              <div class="source-section-header">
                <span class="source-section-title">${escapeHtml(category.source_groups.length === 1 ? "数据来源" : group.label)}</span>
                ${group.sources.length > 1 ? `<span class="source-bulk-actions">
                  <button type="button" data-source-action="enable" ${disabled ? "disabled" : ""}>全选</button>
                  <button type="button" data-source-action="disable" ${disabled ? "disabled" : ""}>清空</button>
                </span>` : ""}
              </div>
              <div class="source-list">${group.sources.map((source) => `<label class="source-row"><input class="source-toggle" data-source="${escapeHtml(source.id)}" type="checkbox" ${sourceEnabled(category.id, source.id) ? "checked" : ""} ${disabled ? "disabled" : ""}><span>${escapeHtml(source.label)}</span></label>`).join("")}</div>
            </div>`).join("")}
        </div>
        ${category.id === "earthquake_warning" ? intensityRuleEditor(disabled) : filters ? `<div class="rule-section"><div class="rule-section-header"><span class="rule-section-title">匹配规则</span></div><div class="rule-grid">${filters}</div></div>` : ""}
      </div>
    </section>`;
    }).join("");
    ctx.notifyBandsEl = ctx.root.querySelector("#notify-bands");
    ctx.notifyWarning = ctx.root.querySelector("#notify-warning");
    if (ctx.notifyBandsEl) renderNotifyBands();
  }

  async function loadSubscriptionOptions(
    draft: SubscriptionDraft,
    generation: number,
    mergeOptions: { missingEnabled: boolean },
  ): Promise<void> {
    const res = await fetch(`${ctx.api}/api/subscription-options`);
    const json = await parseApiResponse(res);
    if (generation !== ctx.initializationGeneration) return;
    const data = json.data as { categories?: CategoryOption[] } | undefined;
    if (!res.ok || !json.success || !Array.isArray(data?.categories)) throw new Error(json.message || "无法获取灾害来源");
    ctx.optionCategories = data.categories;
    const savedEntries = draft.alerts_by_category && typeof draft.alerts_by_category === "object"
      ? draft.alerts_by_category
      : {};
    ctx.subscriptionDraft.alerts_by_category = mergeAlertsByCategory(
      ctx.optionCategories,
      savedEntries,
      mergeOptions.missingEnabled,
      sanitizeAlertRule,
    );
    delete ctx.subscriptionDraft.legacy_alerts;
    delete ctx.subscriptionDraft.legacy_disabled_alerts;
    renderDisasterGroups();
  }

  function validateAlertRules(): string {
    const alerts = enabledAlertRules();
    if (!alerts.length) return "请至少启用一种灾害类别";
    const numeric = (value: unknown) => String(value ?? "").trim() ? Number(value) : NaN;
    const magnitude = numeric(alertRule("earthquake_report")?.min_magnitude);
    const weatherRadius = numeric(alertRule("weather_warning")?.fallback_radius_km);
    const typhoonRadius = numeric(alertRule("typhoon")?.max_center_distance_km);
    const weatherLevel = numeric(alertRule("weather_warning")?.min_severity);
    const tsunamiLevel = numeric(alertRule("tsunami")?.min_severity);
    if (alertEntry("earthquake_report")?.enabled && (!Number.isFinite(magnitude) || magnitude < 0 || magnitude > 10)) return "最低震级必须在 0 到 10 之间";
    if (alertEntry("weather_warning")?.enabled && (!Number.isFinite(weatherRadius) || weatherRadius < 1 || weatherRadius > 2000)) return "气象预警回退半径必须在 1 到 2000 公里之间";
    if (alertEntry("typhoon")?.enabled && (!Number.isFinite(typhoonRadius) || typhoonRadius < 1 || typhoonRadius > 3000)) return "台风中心最大距离必须在 1 到 3000 公里之间";
    if (alertEntry("weather_warning")?.enabled && ![1, 2, 3, 4].includes(weatherLevel)) return "气象预警最低级别必须在 1 到 4 之间";
    if (alertEntry("tsunami")?.enabled && ![1, 2, 3, 4].includes(tsunamiLevel)) return "海啸预警最低级别必须在 1 到 4 之间";
    for (const category of ctx.optionCategories) {
      const entry = alertEntry(category.id);
      if (entry?.enabled && entry.rule.sources?.mode === "include" && !entry.rule.sources.ids?.length) return `${category.label}请至少启用一个来源`;
    }
    return "";
  }

  ctx.cleanup.listen(ctx.el.resetAlertRules, "click", () => {
    if (!ctx.configurationReady) {
      helpers.show("订阅配置尚未加载完成", "error");
      return;
    }
    if (!confirm("恢复所有预警类型和规则为默认设置？监测地点和接收设备不会改变。")) return;
    ctx.subscriptionDraft.alerts_by_category = Object.fromEntries(ctx.optionCategories.map((category) => [
      category.id, { enabled: true, rule: cloneJson(category.default_alert) },
    ]));
    setNotifyWarning("");
    renderDisasterGroups();
    helpers.persistDraft();
    helpers.show("预警规则已恢复默认设置", "success");
  });

  ctx.cleanup.listen(ctx.el.disasterGroupsEl, "click", (event) => {
    const target = event.target as HTMLElement | null;
    const expand = target?.closest("[data-expand-category]") as HTMLElement | null;
    if (expand) {
      const card = expand.closest("[data-category-card]");
      const detail = card?.querySelector(".disaster-detail") as HTMLElement | null;
      const expanded = expand.getAttribute("aria-expanded") === "true";
      if (!detail || detail.dataset.animating === "true") return;
      detail.dataset.animating = "true";
      expand.setAttribute("aria-expanded", String(!expanded));
      if (expanded) ctx.expandedDisasterCategories.delete(expand.dataset.expandCategory || "");
      else ctx.expandedDisasterCategories.add(expand.dataset.expandCategory || "");
      if (expanded) {
        animateHeight(detail, false, () => {
          detail.hidden = true;
          detail.dataset.animating = "false";
        });
      } else {
        detail.hidden = false;
        animateHeight(detail, true, () => { detail.dataset.animating = "false"; });
      }
      return;
    }

    const intensityAction = target?.closest("[data-intensity-action]") as HTMLElement | null;
    if (intensityAction) {
      if (!commitBands()) return;
      const rule = alertRule("earthquake_warning");
      if (!rule) return;
      if (intensityAction.dataset.intensityAction === "reset") {
        rule.estimated_intensity_bands = defaultNotifyBands().map((band) => ({
          min: band.min, max: band.max, interruption_level: band.level,
        }));
        setNotifyWarning("");
        renderDisasterGroups();
        helpers.persistDraft();
        return;
      }
      const bands = normalizeBands(rule.estimated_intensity_bands);
      const used = new Set(bands.map((band) => band.level));
      const level = notifyLevelOrder.find((item) => !used.has(item));
      if (!level) {
        setNotifyWarning("通知级别规则最多 3 条");
        return;
      }
      bands.push({
        min: level === "passive" ? 0 : level === "active" ? 2 : 3,
        max: level === "critical" ? 7 : level === "active" ? 2 : 1,
        level,
        label: levelLabel(level),
      });
      rule.estimated_intensity_bands = bands.map((band) => ({ min: band.min, max: band.max, interruption_level: band.level }));
      renderDisasterGroups();
      helpers.persistDraft();
      return;
    }

    const removeRule = target?.closest("[data-action='remove-rule']") as HTMLElement | null;
    if (removeRule) {
      const bands = collectBands().filter((band) => Number.isInteger(band.min) && Number.isInteger(band.max));
      const ruleRow = removeRule.closest(".intensity-rule") as HTMLElement | null;
      bands.splice(Number(ruleRow?.dataset.index), 1);
      const nextBands = bands.length ? bands : defaultNotifyBands();
      const warningRule = alertRule("earthquake_warning");
      if (warningRule) {
        warningRule.estimated_intensity_bands = nextBands.map((band) => ({ min: band.min, max: band.max, interruption_level: band.level }));
      }
      renderDisasterGroups();
      helpers.persistDraft();
      return;
    }

    const bulkAction = target?.closest("[data-source-action]") as HTMLElement | null;
    if (!bulkAction) return;
    const sourceSection = bulkAction.closest("[data-source-group]");
    const enabled = bulkAction.dataset.sourceAction === "enable";
    const category = (sourceSection?.closest("[data-category-card]") as HTMLElement | null)?.dataset.categoryCard;
    if (!sourceSection || !category || !alertEntry(category)?.enabled) return;
    const groupIds = new Set([...sourceSection.querySelectorAll<HTMLElement>("[data-source]")].map((input) => input.dataset.source || ""));
    const selected = sourceIds(category).filter((id) => sourceEnabled(category, id));
    setSelectedSources(category, enabled
      ? [...new Set([...selected, ...groupIds])]
      : selected.filter((id) => !groupIds.has(id)));
    renderDisasterGroups();
    helpers.persistDraft();
  });

  ctx.cleanup.listen(ctx.el.disasterGroupsEl, "change", (event) => {
    const eventTarget = event.target as HTMLElement | null;
    if (!eventTarget) return;
    if (eventTarget.closest("#notify-bands")) {
      updateBandDraft(eventTarget);
      return;
    }
    const category = eventTarget.dataset.category;
    const source = eventTarget.dataset.source;
    const rule = eventTarget.dataset.rule;
    if (category && eventTarget instanceof HTMLInputElement) {
      if (category === "earthquake_warning" && eventTarget.checked && !commitBands()) {
        eventTarget.checked = true;
        return;
      }
      const entry = alertEntry(category);
      if (entry) entry.enabled = eventTarget.checked;
      setNotifyWarning("");
      renderDisasterGroups();
    }
    if (source && eventTarget instanceof HTMLInputElement) {
      const categoryId = (eventTarget.closest("[data-category-card]") as HTMLElement | null)?.dataset.categoryCard;
      if (!categoryId || !alertEntry(categoryId)?.enabled) return;
      const ids = sourceIds(categoryId).filter((id) => id === source ? eventTarget.checked : sourceEnabled(categoryId, id));
      setSelectedSources(categoryId, ids);
      renderDisasterGroups();
    }
    if (rule && (eventTarget instanceof HTMLInputElement || eventTarget instanceof HTMLSelectElement)) {
      const categoryId = (eventTarget.closest("[data-category-card]") as HTMLElement | null)?.dataset.categoryCard;
      const alert = categoryId ? alertRule(categoryId) : null;
      if (categoryId && alertEntry(categoryId)?.enabled && alert) {
        (alert as Record<string, unknown>)[rule] = eventTarget.value;
        renderDisasterGroups();
      }
    }
    helpers.persistDraft();
  });

  ctx.cleanup.listen(ctx.el.disasterGroupsEl, "input", (event) => {
    const eventTarget = event.target as HTMLElement | null;
    if (eventTarget?.closest("#notify-bands .band-min, #notify-bands .band-max")) updateBandDraft(eventTarget);
  });
  ctx.cleanup.listen(ctx.el.disasterGroupsEl, "blur", (event) => {
    const eventTarget = event.target as HTMLElement | null;
    if (eventTarget?.closest("#notify-bands .band-min, #notify-bands .band-max")) setNotifyWarning(validateBands(collectBands()));
  }, true);

  return {
    loadSubscriptionOptions,
    renderDisasterGroups,
    validateAlertRules,
    enabledAlertRules,
    alertRuleForPayload,
    alertEntry,
    commitBands,
  };
}
