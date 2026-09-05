import { useState } from "react";
import { Activity, CloudRain, Tornado, WavesHorizontal } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { X } from "lucide-react";
import { Field } from "../components/Field";
import { cn } from "@/lib/utils";
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

const CATEGORY_ICONS = {
  earthquake_warning: Activity,
  earthquake_report: Activity,
  weather_warning: CloudRain,
  tsunami: WavesHorizontal,
  typhoon: Tornado,
} as const;

function CategoryIcon({ categoryId, active }: { categoryId: string; active: boolean }) {
  const Icon = CATEGORY_ICONS[categoryId as keyof typeof CATEGORY_ICONS] ?? Activity;
  return (
    <span
      data-category-icon={categoryId}
      data-active={active ? "true" : "false"}
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full border",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground",
      )}
    >
      <Icon className="size-5" strokeWidth={1.75} aria-hidden />
    </span>
  );
}

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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notifyWarning, setNotifyWarning] = useState("");
  const openCategory = expanded === null ? categories[0]?.id ?? "" : expanded;

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
          id="reset-alert-rules"
          type="button"
          variant="link"
          size="sm"
          className="h-auto px-0 text-muted-foreground"
          disabled={inFlight || !configurationReady}
          onClick={onResetRequest}
        >
          重置规则
        </Button>
      </div>
      <Accordion
        type="single"
        collapsible
        id="disaster-groups"
        className="disaster-groups"
        value={openCategory}
        onValueChange={setExpanded}
      >
        {categories.map((category) => {
          const entry = alertEntry(draft, category.id);
          const disabled = !entry?.enabled;
          const sourceCount = category.source_groups.reduce((total, group) => total + group.sources.length, 0);
          const enabledCount = category.source_groups.reduce(
            (total, group) => total + group.sources.filter((source) => sourceEnabled(draft, category.id, source.id)).length,
            0,
          );
          const sourceMode = entry?.rule.sources?.mode;
          const sourceSummary = sourceMode === "all" ? `全部 ${sourceCount} 个来源` : `已选 ${enabledCount}/${sourceCount} 个来源`;
          const ruleSummary = categoryRuleSummary(draft, category.id);
          const selected = openCategory === category.id;
          return (
            <AccordionItem
              key={category.id}
              value={category.id}
              className={cn("disaster-category border-0", disabled && "is-disabled")}
              data-category-card={category.id}
            >
              <div className="disaster-category-header">
                <AccordionTrigger
                  hideChevron
                  className="category-expand h-auto min-h-16 w-full justify-start gap-3 rounded-none px-2 py-3 font-normal hover:bg-transparent hover:no-underline"
                  data-expand-category={category.id}
                >
                  <CategoryIcon categoryId={category.id} active={selected} />
                  <span className="category-copy">
                    <span className="category-title">{category.label}</span>
                    <span className="category-meta">{`${sourceSummary}${ruleSummary ? ` · ${ruleSummary}` : ""}`}</span>
                  </span>
                </AccordionTrigger>
                <Switch
                  className="category-toggle mx-3"
                  data-category={category.id}
                  aria-label={disabled ? `启用${category.label}` : `停用${category.label}`}
                  checked={!disabled}
                  onCheckedChange={(checked) => {
                    if (category.id === "earthquake_warning" && checked) {
                      const error = commitBands(draft);
                      if (error) {
                        setNotifyWarning(error);
                        return;
                      }
                    }
                    mutate((current) => {
                      const row = current.alerts_by_category[category.id];
                      if (row) row.enabled = checked;
                    });
                    setNotifyWarning("");
                  }}
                />
              </div>
              <AccordionContent>
                <div className="disaster-detail">
                    <div className="source-overview">
                      {category.source_groups.map((group) => (
                        <div key={group.id} className="source-section" data-source-group={group.id}>
                          <div className="source-section-header">
                            <span className="source-section-title">{category.source_groups.length === 1 ? "数据来源" : group.label}</span>
                            {group.sources.length > 1 ? (
                              <span className="source-bulk-actions">
                                <Button type="button" variant="ghost" size="sm" data-source-action="enable" disabled={disabled} onClick={() => {
                                  mutate((current) => {
                                    const groupIds = group.sources.map((source) => source.id);
                                    const selected = sourceIdsFor(categories, category.id).filter((id) => sourceEnabled(current, category.id, id));
                                    setSelectedSources(current, categories, category.id, [...new Set([...selected, ...groupIds])]);
                                  });
                                }}>全选</Button>
                                <Button type="button" variant="ghost" size="sm" data-source-action="disable" disabled={disabled} onClick={() => {
                                  mutate((current) => {
                                    const groupIds = new Set(group.sources.map((source) => source.id));
                                    const selected = sourceIdsFor(categories, category.id).filter((id) => sourceEnabled(current, category.id, id));
                                    setSelectedSources(current, categories, category.id, selected.filter((id) => !groupIds.has(id)));
                                  });
                                }}>清空</Button>
                              </span>
                            ) : null}
                          </div>
                          <div className="source-list">
                            {group.sources.map((source) => {
                              const sourceInputId = `${category.id}-${source.id}`;
                              return (
                              <div key={source.id} className="source-row">
                                <Checkbox
                                  id={sourceInputId}
                                  className="source-toggle"
                                  data-source={source.id}
                                  checked={sourceEnabled(draft, category.id, source.id)}
                                  disabled={disabled}
                                  onCheckedChange={(checked) => {
                                    mutate((current) => {
                                      const ids = sourceIds(category).filter((id) => id === source.id ? checked === true : sourceEnabled(current, category.id, id));
                                      setSelectedSources(current, categories, category.id, ids);
                                    });
                                  }}
                                />
                                <Label htmlFor={sourceInputId} className="font-medium">{source.label}</Label>
                              </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    {category.id === "earthquake_warning" ? (
                      <div className="rule-section">
                        <div className="rule-section-header">
                          <span className="rule-section-title">通知规则</span>
                          <span className="intensity-actions">
                            <Button type="button" variant="ghost" size="sm" data-intensity-action="add" disabled={disabled} onClick={() => {
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
                            }}>添加规则</Button>
                            <Button type="button" variant="ghost" size="sm" data-intensity-action="reset" disabled={disabled} onClick={() => {
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
                            }}>恢复默认</Button>
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
                                  <Field label="预估烈度范围">
                                    <span className="intensity-range">
                                      <Input className="band-min text-center" type="number" min={0} max={7} step={1} value={String(band.min ?? "")} aria-label="起始烈度" disabled={disabled} onChange={(event) => {
                                        mutate((current) => {
                                          const row = current.alerts_by_category.earthquake_warning?.rule.estimated_intensity_bands?.[index];
                                          if (row) row.min = event.target.value;
                                        });
                                        setNotifyWarning(validateBands(collectBands(draft)));
                                      }} />
                                      <span>至</span>
                                      <Input className="band-max text-center" type="number" min={0} max={7} step={1} value={String(band.max ?? "")} aria-label="最高烈度" disabled={disabled} onChange={(event) => {
                                        mutate((current) => {
                                          const row = current.alerts_by_category.earthquake_warning?.rule.estimated_intensity_bands?.[index];
                                          if (row) row.max = event.target.value;
                                        });
                                        setNotifyWarning(validateBands(collectBands(draft)));
                                      }} />
                                    </span>
                                  </Field>
                                  <Field label="通知级别">
                                    <NativeSelect className={`band-select level-${level}`} disabled={disabled} value={level} onChange={(event) => {
                                      mutate((current) => {
                                        const row = current.alerts_by_category.earthquake_warning?.rule.estimated_intensity_bands?.[index];
                                        if (row) row.interruption_level = event.target.value;
                                      });
                                    }}>
                                      {notifyLevelOrder.map((item) => (
                                        <option key={item} value={item}>{levelLabel(item)}</option>
                                      ))}
                                    </NativeSelect>
                                  </Field>
                                </div>
                                <Button className="remove-intensity-rule" type="button" variant="ghost" size="icon" data-action="remove-rule" aria-label={`删除规则 ${index + 1}`} title="删除规则" disabled={disabled} onClick={() => {
                                  mutate((current) => {
                                    const rule = current.alerts_by_category.earthquake_warning?.rule;
                                    if (!rule) return;
                                    const bands = collectBands(current).filter((item) => Number.isInteger(item.min) && Number.isInteger(item.max));
                                    bands.splice(index, 1);
                                    const nextBands = bands.length ? bands : defaultNotifyBands();
                                    rule.estimated_intensity_bands = nextBands.map((item) => ({ min: item.min, max: item.max, interruption_level: item.level }));
                                  });
                                }}>
                                  <X />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                        {notifyWarning ? (
                          <Alert id="notify-warning" variant="destructive">
                            <AlertDescription>{notifyWarning}</AlertDescription>
                          </Alert>
                        ) : (
                          <div id="notify-warning" hidden />
                        )}
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
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
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
          <Field label="最低震级" htmlFor={`${categoryId}-min-magnitude`} hint="仅筛选地震信息，不影响地震预警。">
            <Input id={`${categoryId}-min-magnitude`} data-rule="min_magnitude" type="number" min={0} max={10} step="0.1" value={String(alert.min_magnitude ?? "")} disabled={disabled} onChange={(event) => onChange("min_magnitude", event.target.value)} />
          </Field>
        </div>
      </div>
    );
  }
  if (categoryId === "weather_warning") {
    return (
      <div className="rule-section">
        <div className="rule-section-header"><span className="rule-section-title">匹配规则</span></div>
        <div className="rule-grid">
          <Field label="最低严重度" htmlFor={`${categoryId}-min-severity`} hint="低于此级别的气象预警不推送。">
            <NativeSelect id={`${categoryId}-min-severity`} data-rule="min_severity" disabled={disabled} value={String(alert.min_severity ?? "")} onChange={(event) => onChange("min_severity", event.target.value)}>
              {LEVEL_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="坐标回退半径" htmlFor={`${categoryId}-fallback-radius`} hint="行政区未命中时，按地点周边公里数匹配。">
            <Input id={`${categoryId}-fallback-radius`} data-rule="fallback_radius_km" type="number" min={1} max={2000} step={1} value={String(alert.fallback_radius_km ?? "")} disabled={disabled} onChange={(event) => onChange("fallback_radius_km", event.target.value)} />
          </Field>
        </div>
      </div>
    );
  }
  if (categoryId === "tsunami") {
    return (
      <div className="rule-section">
        <div className="rule-section-header"><span className="rule-section-title">匹配规则</span></div>
        <div className="rule-grid">
          <Field label="最低严重度" htmlFor={`${categoryId}-min-severity`} hint="结合监测地点的行政区进行匹配。">
            <NativeSelect id={`${categoryId}-min-severity`} data-rule="min_severity" disabled={disabled} value={String(alert.min_severity ?? "")} onChange={(event) => onChange("min_severity", event.target.value)}>
              {LEVEL_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </div>
    );
  }
  if (categoryId === "typhoon") {
    return (
      <div className="rule-section">
        <div className="rule-section-header"><span className="rule-section-title">匹配规则</span></div>
        <div className="rule-grid">
          <Field label="中心最大距离" htmlFor={`${categoryId}-max-center`} hint="台风中心距离任一监测地点不超过此公里数。">
            <Input id={`${categoryId}-max-center`} data-rule="max_center_distance_km" type="number" min={1} max={3000} step={1} value={String(alert.max_center_distance_km ?? "")} disabled={disabled} onChange={(event) => onChange("max_center_distance_km", event.target.value)} />
          </Field>
        </div>
      </div>
    );
  }
  return null;
}
