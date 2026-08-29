import { bindAlertRules } from "./alerts";
import { cloneTarget, targetCoordinates, validateLocations } from "./geo";
import {
  draftSignature,
  incompleteTarget,
  restoreDraftFromStorage,
  writeDraft,
} from "./draft";
import { escapeHtml } from "./html";
import { parseApiResponse } from "./http";
import { bindLocations } from "./locations";
import { animateHeight } from "./motion";
import { createRuntime } from "./runtime";
import { bindStatus } from "./status";
import { bindToast } from "./toast";
import type { MountSubscribeOptions } from "./types";

export function mountSubscribeApp(root: HTMLElement, options: MountSubscribeOptions): () => void {
  const ctx = createRuntime(root, options);
  const toast = bindToast(ctx);
  const { el } = ctx;

  function currentDestinationIdentity(): string {
    return `${el.barkUrlInput.value}\n${el.barkInput.value.trim()}`;
  }

  function updateDraftStatus(): void {
    if (!ctx.instanceTermsAccepted) {
      el.draftStatus.textContent = "当前实例未确认部署责任，不能新增或覆盖订阅；仍可取消已有订阅。";
    } else if (!ctx.lastSubmittedSignature) {
      el.draftStatus.textContent = "配置草稿保存在当前浏览器；Bark Key 不会保存。";
    } else if (draftSignature(ctx.subscriptionDraft) === ctx.lastSubmittedSignature && currentDestinationIdentity() === ctx.lastSubmittedIdentity) {
      el.draftStatus.textContent = "本浏览器中的配置已提交。";
    } else {
      el.draftStatus.textContent = "有尚未提交的配置更改。";
    }
  }

  function persistDraft(): void {
    updateDraftStatus();
    if (ctx.persistTimer) clearTimeout(ctx.persistTimer);
    ctx.persistTimer = setTimeout(() => {
      writeDraft(ctx.subscriptionDraft);
      ctx.persistTimer = null;
    }, 150);
  }

  function flushDraft(): void {
    if (ctx.persistTimer) clearTimeout(ctx.persistTimer);
    writeDraft(ctx.subscriptionDraft);
    ctx.persistTimer = null;
  }

  const locations = bindLocations(ctx, { persistDraft, show: toast.show });
  const alerts = bindAlertRules(ctx, { persistDraft, show: toast.show });
  const status = bindStatus(ctx);

  if (options.initialBarkKey) {
    el.barkInput.value = options.initialBarkKey;
  }
  el.barkInput.readOnly = true;

  function setSubscriptionRequestInFlight(inFlight: boolean): void {
    ctx.subscriptionRequestInFlight = inFlight;
    el.submit.disabled = inFlight || !ctx.configurationReady || !ctx.instanceTermsAccepted;
    el.submit.title = ctx.instanceTermsAccepted ? "" : "实例部署者确认责任声明后才能保存订阅";
    el.unsubscribe.disabled = inFlight;
    el.resetAlertRules.disabled = inFlight || !ctx.configurationReady;
    el.startAddLocation.disabled = inFlight || ctx.subscriptionDraft.targets.length >= 3 || ctx.uiState.locationMode !== "overview";
    el.finishLocation.disabled = inFlight || (ctx.uiState.locationMode !== "overview" && !targetCoordinates(locations.activeTarget()));
    el.discardLocationEdit.disabled = inFlight;
  }

  root.querySelectorAll("details.config-disclosure").forEach((node) => {
    const details = node as HTMLDetailsElement;
    const summary = details.querySelector(":scope > summary");
    const body = details.querySelector(":scope > .config-disclosure-body") as HTMLElement | null;
    if (!summary || !body) return;
    ctx.cleanup.listen(summary, "click", (event) => {
      event.preventDefault();
      if (details.dataset.animating === "true") return;
      details.dataset.animating = "true";
      if (details.open) {
        animateHeight(body, false, () => {
          details.open = false;
          details.dataset.animating = "false";
        });
      } else {
        details.open = true;
        animateHeight(body, true, () => { details.dataset.animating = "false"; });
      }
    });
  });

  async function loadBarkUrls(generation: number): Promise<void> {
    const res = await fetch(`${ctx.api}/api/bark-urls`);
    const json = await parseApiResponse(res);
    if (generation !== ctx.initializationGeneration) return;
    const data = json.data as { bark_urls?: unknown } | undefined;
    if (!res.ok || !json.success || !Array.isArray(data?.bark_urls) || !data.bark_urls.length) {
      throw new Error(json.message || "没有可用的 Bark URL");
    }
    ctx.barkUrls = data.bark_urls.filter((value): value is string => typeof value === "string" && Boolean(value));
    if (!ctx.barkUrls.length) throw new Error("没有可用的 Bark URL");
    const savedUrl = typeof ctx.subscriptionDraft.bark_url === "string" ? ctx.subscriptionDraft.bark_url : "";
    const removedSavedUrl = savedUrl && !ctx.barkUrls.includes(savedUrl);
    el.barkUrlInput.innerHTML = `${removedSavedUrl ? '<option value="">请选择 Bark URL</option>' : ""}${ctx.barkUrls.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
    el.barkUrlInput.value = removedSavedUrl ? "" : savedUrl && ctx.barkUrls.includes(savedUrl) ? savedUrl : ctx.barkUrls[0];
    ctx.subscriptionDraft.bark_url = el.barkUrlInput.value;
    el.barkUrlInput.disabled = false;
    el.barkUrlField.style.display = "";
  }

  function initializeConfiguration(): Promise<void> {
    const generation = ++ctx.initializationGeneration;
    ctx.configurationReady = false;
    el.retryConfig.classList.remove("visible");
    el.barkUrlInput.disabled = true;
    setSubscriptionRequestInFlight(false);
    return Promise.all([loadBarkUrls(generation), alerts.loadSubscriptionOptions(ctx.subscriptionDraft, generation)])
      .then(() => {
        if (generation !== ctx.initializationGeneration) return;
        ctx.configurationReady = true;
        setSubscriptionRequestInFlight(false);
        locations.fitTargetMarkers();
        updateDraftStatus();
        persistDraft();
        toast.dismissPersistentToasts();
      })
      .catch((error: { message?: string }) => {
        if (generation !== ctx.initializationGeneration) return;
        ctx.configurationReady = false;
        el.barkUrlInput.disabled = true;
        el.retryConfig.classList.add("visible");
        setSubscriptionRequestInFlight(false);
        toast.show(error.message || "无法加载订阅配置", "error");
      });
  }

  ctx.cleanup.listen(el.barkUrlInput, "change", () => {
    ctx.subscriptionDraft.bark_url = el.barkUrlInput.value;
    persistDraft();
  });
  ctx.cleanup.listen(el.barkInput, "input", () => updateDraftStatus());
  ctx.cleanup.listen(el.retryConfig, "click", () => {
    toast.show("正在重新加载订阅配置...", "info");
    void initializeConfiguration();
  });

  ctx.cleanup.listen(el.form, "submit", async (event) => {
    event.preventDefault();
    if (!ctx.instanceTermsAccepted) {
      toast.show("当前实例尚未确认部署责任，不能新增或覆盖订阅", "error");
      return;
    }
    if (!ctx.configurationReady) {
      toast.show("订阅配置尚未加载完成", "error");
      return;
    }
    if (alerts.alertEntry("earthquake_warning")?.enabled && !alerts.commitBands()) {
      toast.show("请修正通知级别规则", "error");
      return;
    }
    const alertRuleError = alerts.validateAlertRules();
    if (alertRuleError) {
      toast.show(alertRuleError, "error");
      return;
    }
    if (!ctx.subscriptionDraft.targets.length) {
      toast.show("请至少添加一个监测地点", "error");
      return;
    }
    const locationError = validateLocations(ctx.subscriptionDraft.targets);
    if (locationError) {
      toast.show(locationError, "error");
      return;
    }
    const barkID = el.barkInput.value.trim();
    if (!/^[A-Za-z0-9]{1,64}$/.test(barkID)) {
      toast.show("Bark Key 只能包含字母和数字", "error");
      return;
    }
    const barkUrl = el.barkUrlInput.value;
    if (!ctx.barkUrls.includes(barkUrl)) {
      toast.show("请选择有效的 Bark URL", "error");
      return;
    }
    const submittedSignature = draftSignature(ctx.subscriptionDraft);
    const payload = {
      destination: { type: "bark", base_url: barkUrl, device_key: barkID },
      targets: ctx.subscriptionDraft.targets.map((target) => ({
        label: target.label.trim(),
        point: { latitude: Number(target.point.latitude), longitude: Number(target.point.longitude) },
        region: {
          province: target.region.province.trim(), city: target.region.city.trim(), district: target.region.district.trim(),
        },
      })),
      alerts: alerts.enabledAlertRules().map(alerts.alertRuleForPayload),
    };
    setSubscriptionRequestInFlight(true);
    toast.show("正在覆盖保存订阅...", "info");
    try {
      const res = await fetch(`${ctx.api}/api/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const fallbackMessage = res.status === 502
        ? "Bark 接收测试失败，请检查 Bark Key；若确认无误，请稍后重试"
        : "";
      const json = await parseApiResponse(res, fallbackMessage);
      if (!res.ok || !json.success) throw new Error(json.message || "保存失败");
      ctx.lastSubmittedSignature = submittedSignature;
      ctx.lastSubmittedIdentity = currentDestinationIdentity();
      updateDraftStatus();
      flushDraft();
      const data = json.data as { saved?: boolean } | undefined;
      if (data?.saved === true) {
        toast.show("订阅已保存，Bark 确认通知已发送", "success");
        void status.refreshStatus();
      } else {
        toast.show(json.message || "Bark 服务暂时不可用，订阅确认将在后台重试", "warning");
      }
    } catch (error) {
      toast.show((error as { message?: string }).message || "网络请求失败", "error");
    } finally {
      setSubscriptionRequestInFlight(false);
    }
  });

  ctx.cleanup.listen(el.unsubscribe, "click", async () => {
    const barkID = el.barkInput.value.trim();
    if (!/^[A-Za-z0-9]{1,64}$/.test(barkID)) {
      toast.show("请填写有效的 Bark Key", "error");
      return;
    }
    if (!ctx.barkUrls.includes(el.barkUrlInput.value)) {
      toast.show("请选择有效的 Bark URL", "error");
      return;
    }
    if (!confirm("确定删除该 Bark 服务与 Key 对应的服务端订阅？当前浏览器中的配置草稿会保留。")) return;
    if (ctx.subscriptionRequestInFlight) return;
    setSubscriptionRequestInFlight(true);
    toast.show("正在取消订阅...", "info");
    try {
      const res = await fetch(`${ctx.api}/api/unsubscribe`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: { type: "bark", base_url: el.barkUrlInput.value, device_key: barkID },
        }),
      });
      const json = await parseApiResponse(res);
      if (!res.ok || !json.success) throw new Error(json.message || "取消失败");
      ctx.lastSubmittedSignature = "";
      ctx.lastSubmittedIdentity = "";
      updateDraftStatus();
      toast.show("已删除服务端订阅；浏览器配置草稿已保留", "success");
      void status.refreshStatus();
    } catch (error) {
      toast.show((error as { message?: string }).message || "网络请求失败", "error");
    } finally {
      setSubscriptionRequestInFlight(false);
    }
  });

  const draft = restoreDraftFromStorage();
  ctx.subscriptionDraft = draft;
  const incomplete = incompleteTarget(draft);
  if (incomplete) {
    ctx.uiState.activeTargetId = incomplete.id;
    ctx.uiState.locationMode = "editing";
    ctx.uiState.editingTarget = cloneTarget(incomplete);
  }
  locations.renderLocations();
  locations.renderLocationEditor();
  void initializeConfiguration();
  void status.refreshStatus();

  ctx.cleanup.add(() => {
    if (ctx.persistTimer) clearTimeout(ctx.persistTimer);
  });

  return () => {
    ctx.initializationGeneration += 1;
    locations.cancelAllGeocode();
    ctx.cleanup.run();
  };
}
