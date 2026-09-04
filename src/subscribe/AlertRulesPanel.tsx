import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  alertEntry,
  categoryRuleSummary,
  cloneJson,
  collectBands,
  commitBands,
  defaultNotifyBands,
  levelLabel,
  normalizeBands,
  notifyLevelOrder,
  setSelectedSources,
  sourceEnabled,
  sourceIds,
  sourceIdsFor,
  validateBands,
} from "./alertLogic";
import type { CategoryOption, SubscriptionDraft } from "./types";

const LEVEL_OPTIONS = [
  [1, "蓝色/信息"],
  [2, "黄色"],
  [3, "橙色"],
  [4, "红色"],
] as const;

export function AlertRulesPanel({
  draft,
  setDraft,
  categories,
  configurationReady,
  inFlight,
  onResetRequest,
  connectedSources,
}: {
  draft: SubscriptionDraft;
  setDraft: (updater: (current: SubscriptionDraft) => SubscriptionDraft) => void;
  categories: CategoryOption[];
  configurationReady: boolean;
  inFlight: boolean;
  onResetRequest: () => void;
  connectedSources: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [notifyWarning, setNotifyWarning] = useState("");

  function mutate(updater: (current: SubscriptionDraft) => void): void {
    setDraft((current) => {
      const next = cloneJson(current);
      updater(next);
      return next;
    });
  }

  return (
    <section className="workspace-section">
      <div className="workspace-heading">
        <div className="workspace-heading-title">
          <h2>预警类型</h2>
          <span id="alert-type-sources" className="heading-sources" hidden={!connectedSources}>
            {connectedSources}
          </span>
        </div>
        <Button
          className="heading-action"
          id="reset-alert-rules"
          type="button"
          variant="ghost"
          disabled={inFlight || !configurationReady}
          onClick={onResetRequest}
        >
          重置规则
        </Button>
      </div>
      <div id="disaster-groups" className="disaster-groups">
        {categories.map((category) => {
          const entry = alertEntry(draft, category.id);
          const disabled = !entry?.enabled;
          const sourceCount = category.source_groups.reduce((total, group) => total + group.sources.length, 0);
          const enabledCount = category.source_groups.reduce(
            (total, group) => total + group.sources.filter((source) => sourceEnabled(draft, category.id, source.id)).length,
            0,
          );
          const isExpanded = expanded.has(category.id);
          const sourceMode = entry?.rule.sources?.mode;
          const sourceSummary = sourceMode === "all" ? `全部 ${sourceCount} 个来源` : `已选 ${enabledCount}/${sourceCount} 个来源`;
          const ruleSummary = categoryRuleSummary(draft, category.id);
          return (
            <Collapsible
              key={category.id}
              open={isExpanded}
              onOpenChange={(open) => {
                setExpanded((current) => {
                  const next = new Set(current);
                  if (open) next.add(category.id);
                  else next.delete(category.id);
                  return next;
                });
              }}
            >
              <section className={`disaster-category ${disabled ? "is-disabled" : ""}`} data-category-card={category.id}>
                <div className="disaster-category-header">
                  <CollapsibleTrigger asChild>
                    <button className="category-expand" type="button" data-expand-category={category.id} aria-expanded={isExpanded}>
                      <span className="category-chevron">›</span>
                      <span className="category-copy">
                        <span className="category-title">{category.label}</span>
                        <span className="category-meta">{disabled ? "已关闭" : `${sourceSummary}${ruleSummary ? ` · ${ruleSummary}` : ""}`}</span>
                      </span>
                    </button>
                  </CollapsibleTrigger>
                  <label className="switch" aria-label={disabled ? `启用${category.label}` : `停用${category.label}`}>
                    <input
                      className="category-toggle"
                      data-category={category.id}
                      type="checkbox"
                      checked={!disabled}
                      onChange={(event) => {
                        if (category.id === "earthquake_warning" && event.target.checked) {
                          const error = commitBands(draft);
                          if (error) {
                            setNotifyWarning(error);
                            return;
                          }
                        }
                        mutate((current) => {
                          const row = current.alerts_by_category[category.id];
                          if (row) row.enabled = event.target.checked;
                        });
                        setNotifyWarning("");
                      }}
                    />
                    <span className="switch-track" />
                  </label>
                </div>
                <CollapsibleContent>
                  <div className="disaster-detail">
                    <div className="source-overview">
                      {category.source_groups.map((group) => (
                        <div key={group.id} className="source-section" data-source-group={group.id}>
                          <div className="source-section-header">
                            <span className="source-section-title">{category.source_groups.length === 1 ? "数据来源" : group.label}</span>
                            {group.sources.length > 1 ? (
                              <span className="source-bulk-actions">
                                <button type="button" data-source-action="enable" disabled={disabled} onClick={() => {
                                  mutate((current) => {
                                    const groupIds = group.sources.map((source) => source.id);
                                    const selected = sourceIdsFor(categories, category.id).filter((id) => sourceEnabled(current, category.id, id));
                                    setSelectedSources(current, categories, category.id, [...new Set([...selected, ...groupIds])]);
                                  });
                                }}>全选</button>
                                <button type="button" data-source-action="disable" disabled={disabled} onClick={() => {
                                  mutate((current) => {
                                    const groupIds = new Set(group.sources.map((source) => source.id));
                                    const selected = sourceIdsFor(categories, category.id).filter((id) => sourceEnabled(current, category.id, id));
                                    setSelectedSources(current, categories, category.id, selected.filter((id) => !groupIds.has(id)));
                                  });
                                }}>清空</button>
                              </span>
                            ) : null}
                          </div>
                          <div className="source-list">
                            {group.sources.map((source) => (
                              <label key={source.id} className="source-row">
                                <input
                                  className="source-toggle"
                                  data-source={source.id}
                                  type="checkbox"
                                  checked={sourceEnabled(draft, category.id, source.id)}
                                  disabled={disabled}
                                  onChange={(event) => {
                                    mutate((current) => {
                                      const ids = sourceIds(category).filter((id) => id === source.id ? event.target.checked : sourceEnabled(current, category.id, id));
                                      setSelectedSources(current, categories, category.id, ids);
                                    });
                                  }}
                                />
                                <span>{source.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    {category.id === "earthquake_warning" ? (
                      <div className="rule-section">
                        <div className="rule-section-header">
                          <span className="rule-section-title">通知规则</span>
                          <span className="intensity-actions">
                            <button type="button" data-intensity-action="add" disabled={disabled} onClick={() => {
                              const error = commitBands(draft);
                              if (error) {
                                setNotifyWarning(error);
                                return;
                              }
                              mutate((current) => {
                                const rule = current.alerts_by_category.earthquake_warning?.rule;
                                if (!rule) return;
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
                              });
                            }}>添加规则</button>
                            <button type="button" data-intensity-action="reset" disabled={disabled} onClick={() => {
                              const error = commitBands(draft);
                              if (error) {
                                setNotifyWarning(error);
                                return;
                              }
                              mutate((current) => {
                                const rule = current.alerts_by_category.earthquake_warning?.rule;
                                if (!rule) return;
                                rule.estimated_intensity_bands = defaultNotifyBands().map((band) => ({
                                  min: band.min, max: band.max, interruption_level: band.level,
                                }));
                              });
                              setNotifyWarning("");
                            }}>恢复默认</button>
                          </span>
                        </div>
                        <small>按预估烈度决定通知级别，未包含在规则中的烈度不会推送。</small>
                        <div id="notify-bands" className="intensity-rules">
                          {(entry?.rule.estimated_intensity_bands || []).map((band, index) => {
                            const level = String(band.interruption_level ?? band.level ?? "passive").toLowerCase();
                            return (
                              <div key={`${level}-${index}`} className="intensity-rule" data-index={index}>
                                <div className="intensity-rule-header">
                                  <span className="intensity-rule-name">规则 {index + 1}</span>
                                </div>
                                <div className="intensity-rule-fields">
                                  <label className="rule-field">
                                    <span className="rule-field-title">预估烈度范围</span>
                                    <span className="intensity-range">
                                      <input className="band-min" type="number" min={0} max={7} step={1} value={String(band.min ?? "")} aria-label="起始烈度" disabled={disabled} onChange={(event) => {
                                        mutate((current) => {
                                          const row = current.alerts_by_category.earthquake_warning?.rule.estimated_intensity_bands?.[index];
                                          if (row) row.min = event.target.value;
                                        });
                                        setNotifyWarning(validateBands(collectBands(draft)));
                                      }} />
                                      <span>至</span>
                                      <input className="band-max" type="number" min={0} max={7} step={1} value={String(band.max ?? "")} aria-label="最高烈度" disabled={disabled} onChange={(event) => {
                                        mutate((current) => {
                                          const row = current.alerts_by_category.earthquake_warning?.rule.estimated_intensity_bands?.[index];
                                          if (row) row.max = event.target.value;
                                        });
                                        setNotifyWarning(validateBands(collectBands(draft)));
                                      }} />
                                    </span>
                                  </label>
                                  <label className="rule-field">
                                    <span className="rule-field-title">通知级别</span>
                                    <select className={`band-select level-${level}`} disabled={disabled} value={level} onChange={(event) => {
                                      mutate((current) => {
                                        const row = current.alerts_by_category.earthquake_warning?.rule.estimated_intensity_bands?.[index];
                                        if (row) row.interruption_level = event.target.value;
                                      });
                                    }}>
                                      {notifyLevelOrder.map((item) => (
                                        <option key={item} value={item}>{levelLabel(item)}</option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                                <button className="remove-intensity-rule" type="button" data-action="remove-rule" aria-label={`删除规则 ${index + 1}`} title="删除规则" disabled={disabled} onClick={() => {
                                  mutate((current) => {
                                    const rule = current.alerts_by_category.earthquake_warning?.rule;
                                    if (!rule) return;
                                    const bands = collectBands(current).filter((item) => Number.isInteger(item.min) && Number.isInteger(item.max));
                                    bands.splice(index, 1);
                                    const nextBands = bands.length ? bands : defaultNotifyBands();
                                    rule.estimated_intensity_bands = nextBands.map((item) => ({ min: item.min, max: item.max, interruption_level: item.level }));
                                  });
                                }}>×</button>
                              </div>
                            );
                          })}
                        </div>
                        <div id="notify-warning" className={`notify-warning${notifyWarning ? " show" : ""}`}>{notifyWarning}</div>
                      </div>
                    ) : (
                      <ThresholdFields
                        categoryId={category.id}
                        disabled={disabled}
                        draft={draft}
                        onChange={(rule, value) => {
                          mutate((current) => {
                            const alert = current.alerts_by_category[category.id]?.rule;
                            if (alert) (alert as Record<string, unknown>)[rule] = value;
                          });
                        }}
                      />
                    )}
                  </div>
                </CollapsibleContent>
              </section>
            </Collapsible>
          );
        })}
      </div>
    </section>
  );
}

function ThresholdFields({
  categoryId,
  disabled,
  draft,
  onChange,
}: {
  categoryId: string;
  disabled: boolean;
  draft: SubscriptionDraft;
  onChange: (rule: string, value: string) => void;
}) {
  const alert = alertEntry(draft, categoryId)?.rule;
  if (!alert) return null;
  if (categoryId === "earthquake_report") {
    return (
      <div className="rule-section">
        <div className="rule-section-header"><span className="rule-section-title">匹配规则</span></div>
        <div className="rule-grid">
          <label className="rule-field">
            <span className="rule-field-title">最低震级</span>
            <Input data-rule="min_magnitude" type="number" min={0} max={10} step="0.1" value={String(alert.min_magnitude ?? "")} disabled={disabled} onChange={(event) => onChange("min_magnitude", event.target.value)} />
            <small>仅筛选地震信息，不影响地震预警。</small>
          </label>
        </div>
      </div>
    );
  }
  if (categoryId === "weather_warning") {
    return (
      <div className="rule-section">
        <div className="rule-section-header"><span className="rule-section-title">匹配规则</span></div>
        <div className="rule-grid">
          <label className="rule-field">
            <span className="rule-field-title">最低严重度</span>
            <select data-rule="min_severity" disabled={disabled} value={String(alert.min_severity ?? "")} onChange={(event) => onChange("min_severity", event.target.value)}>
              {LEVEL_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <small>低于此级别的气象预警不推送。</small>
          </label>
          <label className="rule-field">
            <span className="rule-field-title">坐标回退半径</span>
            <Input data-rule="fallback_radius_km" type="number" min={1} max={2000} step={1} value={String(alert.fallback_radius_km ?? "")} disabled={disabled} onChange={(event) => onChange("fallback_radius_km", event.target.value)} />
            <small>行政区未命中时，按地点周边公里数匹配。</small>
          </label>
        </div>
      </div>
    );
  }
  if (categoryId === "tsunami") {
    return (
      <div className="rule-section">
        <div className="rule-section-header"><span className="rule-section-title">匹配规则</span></div>
        <div className="rule-grid">
          <label className="rule-field">
            <span className="rule-field-title">最低严重度</span>
            <select data-rule="min_severity" disabled={disabled} value={String(alert.min_severity ?? "")} onChange={(event) => onChange("min_severity", event.target.value)}>
              {LEVEL_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <small>结合监测地点的行政区进行匹配。</small>
          </label>
        </div>
      </div>
    );
  }
  if (categoryId === "typhoon") {
    return (
      <div className="rule-section">
        <div className="rule-section-header"><span className="rule-section-title">匹配规则</span></div>
        <div className="rule-grid">
          <label className="rule-field">
            <span className="rule-field-title">中心最大距离</span>
            <Input data-rule="max_center_distance_km" type="number" min={1} max={3000} step={1} value={String(alert.max_center_distance_km ?? "")} disabled={disabled} onChange={(event) => onChange("max_center_distance_km", event.target.value)} />
            <small>台风中心距离任一监测地点不超过此公里数。</small>
          </label>
        </div>
      </div>
    );
  }
  return null;
}
