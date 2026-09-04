import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, BarChart3, Cloud, CloudRain, MapPin, Server, Tornado, Waves } from "lucide-react";
import { fetchDeviceSubscription, fetchDevices, matchDevice, type DeviceRecord } from "../api";
import { AppShell } from "../components/AppShell";
import { LegalFooter } from "../components/LegalFooter";
import {
  fetchHistoryCatalog,
  fetchSubscriptionOptions,
  simulateHistoryReplay,
  simulateNotifyLevel,
  type HistoryRecord,
  type SimulateResult,
} from "../simulate/client";
import { formatIntensityRange, notifyLevelLabel, notifyLevelsFromOptions, type NotifyLevelOption } from "../simulate/notifyLevels";
import {
  alertRuleCards,
  formatBarkHost,
  formatDraftUpdatedAt,
  formatTargetChip,
  type AlertRuleCard,
} from "../simulate/subscriptionPreview";
import {
  createEmptyDraft,
  draftFromSavedSubscription,
  selectSavedSubscription,
} from "../subscribe/draft";
import "../styles/base.css";
import "../styles/ds.css";
import "../styles/subscribe.css";
import "../styles/test.css";

type TabId = "levels" | "history";

type ActionStatus = {
  kind: "success" | "error";
  text: string;
};

function StatusIcon({ name }: { name: "cloud" | "server" | "pin" }) {
  if (name === "cloud") {
    return <Cloud className="size-4 text-muted-foreground" aria-hidden="true" />;
  }
  if (name === "server") {
    return <Server className="size-4 text-muted-foreground" aria-hidden="true" />;
  }
  return <MapPin className="size-3.5 text-muted-foreground" aria-hidden="true" />;
}

function RuleGlyph({ category }: { category: string }) {
  const common = { className: "size-4 text-muted-foreground", "aria-hidden": true as const };
  if (category === "earthquake_warning") {
    return <Activity {...common} />;
  }
  if (category === "earthquake_report") {
    return <BarChart3 {...common} />;
  }
  if (category === "weather_warning") {
    return <CloudRain {...common} />;
  }
  if (category === "tsunami") {
    return <Waves {...common} />;
  }
  return <Tornado {...common} />;
}

function RuleCard({ card }: { card: AlertRuleCard }) {
  return (
    <li>
      <Card className="flex-row items-center gap-2 px-3 py-2 shadow-none">
        <RuleGlyph category={card.category} />
        <strong className="text-sm font-semibold">{card.title}</strong>
        {card.badge ? (
          <Badge variant={card.badge.tone === "warn" ? "destructive" : "secondary"}>{card.badge.label}</Badge>
        ) : null}
        {card.metric ? <span className="text-muted-foreground text-xs">{card.metric}</span> : null}
      </Card>
    </li>
  );
}

function resultMessage(status: number, message: string, data?: SimulateResult): string {
  if (data && (status < 400)) {
    const extra = [`推送 ${data.pushed}`, `跳过 ${data.skipped}`];
    if (data.event_id) {
      extra.unshift(`事件 ${data.event_id}`);
    }
    return `${message || "已尝试推送"}（${extra.join(" · ")}）`;
  }
  return message || "测试推送失败";
}

function formatDistance(value: number | undefined, unit: string): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${unit}`;
}

export function TestPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [device, setDevice] = useState<DeviceRecord | null>(null);
  const [missing, setMissing] = useState(false);
  const [draft, setDraft] = useState(createEmptyDraft);
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<number | null>(null);
  const [barkUrl, setBarkUrl] = useState("");
  const [levels, setLevels] = useState<NotifyLevelOption[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [historySource, setHistorySource] = useState("major");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("levels");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<ActionStatus | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;
    fetchDevices().then((result) => {
      if (cancelled) {
        return;
      }
      if (result.status === 401) {
        navigate("/login", { replace: true });
        return;
      }
      const found = matchDevice(result.body.data?.devices ?? [], id);
      if (!found) {
        setMissing(true);
        return;
      }
      setDevice(found);
    }).catch(() => {
      if (!cancelled) {
        setMissing(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  useEffect(() => {
    if (!device) {
      return;
    }
    let cancelled = false;
    Promise.all([
      fetchSubscriptionOptions(),
      fetchDeviceSubscription(device.deviceKey),
    ])
      .then(async ([options, saved]) => {
        if (cancelled) {
          return;
        }
        setLevels(notifyLevelsFromOptions(options));
        if (saved.status === 401) {
          navigate("/login", { replace: true });
          return;
        }
        if (saved.status === 404) {
          setMissing(true);
          return;
        }
        if (saved.status === 200 && saved.body.success) {
          const row = selectSavedSubscription(saved.body.data?.subscriptions);
          if (row) {
            const mapped = draftFromSavedSubscription(row);
            setDraft(mapped);
            setDraftUpdatedAt(row.updated_at ?? null);
            setBarkUrl(mapped.bark_url || "");
          }
        } else if (saved.status !== 200) {
          setLoadError(saved.body.message || "无法加载已保存的订阅");
        }
      })
      .catch((error: { message?: string }) => {
        if (!cancelled) {
          setLevels(notifyLevelsFromOptions(null));
          setLoadError(error?.message || "无法加载订阅选项");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [device, navigate]);

  useEffect(() => {
    if (!id || tab !== "history") {
      return;
    }
    let cancelled = false;
    fetchHistoryCatalog()
      .then(({ status, body }) => {
        if (cancelled) {
          return;
        }
        if (status >= 400 || !body.success || !body.data) {
          setHistory([]);
          setHistoryError(body.message || "无法读取历史目录");
          return;
        }
        setHistorySource(body.data.source || "major");
        setHistory(Array.isArray(body.data.records) ? body.data.records : []);
      })
      .catch((error: { message?: string }) => {
        if (!cancelled) {
          setHistory([]);
          setHistoryError(error?.message || "无法读取历史目录");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, tab]);

  if (!id || missing) {
    return <Navigate to="/devices" replace />;
  }

  const alertCards = alertRuleCards(draft);
  const hasDraftContent = draft.targets.length > 0 || alertCards.length > 0;

  const runAction = async (actionId: string, send: () => ReturnType<typeof simulateNotifyLevel>): Promise<void> => {
    setPendingAction(actionId);
    setActionStatus(null);
    try {
      const { status, body } = await send();
      if (status === 401) {
        navigate("/login", { replace: true });
        return;
      }
      const text = resultMessage(status, body.message, body.data);
      setActionStatus({ kind: status < 400 && body.success ? "success" : "error", text });
    } catch (error) {
      setActionStatus({
        kind: "error",
        text: error instanceof Error && error.message ? error.message : "测试推送失败",
      });
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <AppShell
      title="测试通知"
      description={device ? `向「${device.name}」发送测试推送。` : "向当前设备发送测试推送。"}
    >
      <div className="test-page">
      <Card className="test-sheet max-w-none gap-0 py-0 shadow-none">
      <CardContent className="test-sheet-body p-5">
        <div className="test-status-strip" aria-label="设备状态">
          <div className="test-status-cell">
            <StatusIcon name="cloud" />
            <span>{device?.name || "设备"}</span>
          </div>
          <div className="test-status-cell">
            <StatusIcon name="server" />
            <div>
              <span className="test-status-kicker">服务器</span>
              <strong>{formatBarkHost(barkUrl)}</strong>
            </div>
          </div>
          <div className="test-status-cell">
            <span className="test-status-dot" aria-hidden="true" />
            <span>已连接</span>
          </div>
        </div>

        <section className="test-block" aria-labelledby="test-locations-heading">
          <h2 id="test-locations-heading">订阅位置</h2>
          {draft.targets.length ? (
            <ul className="test-location-chips">
              {draft.targets.map((target) => (
                <li key={target.id}>
                  <Badge variant="secondary" className="gap-1 px-2.5 py-1">
                    <StatusIcon name="pin" />
                    {formatTargetChip(target)}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="test-note">尚未选择地点</p>
          )}
        </section>

        <section className="test-block" aria-labelledby="test-rules-heading">
          <h2 id="test-rules-heading">订阅规则</h2>
          {alertCards.length ? (
            <ul className="test-rule-grid">
              {alertCards.map((card) => (
                <RuleCard key={card.category} card={card} />
              ))}
            </ul>
          ) : (
            <p className="test-note">尚未配置规则</p>
          )}
        </section>

        <section className="test-block" aria-labelledby="test-updated-heading">
          <h2 id="test-updated-heading">上次更新</h2>
          <p className="test-note">{formatDraftUpdatedAt(draftUpdatedAt)}</p>
        </section>

        {!hasDraftContent ? (
          <p className="test-note">模拟接口只认本实例已保存的订阅，请先回到订阅页保存。</p>
        ) : null}

        <section className="test-block" aria-labelledby="test-priority-heading">
          <h2 id="test-priority-heading">通知级别</h2>
          <Tabs
            value={tab}
            onValueChange={(value) => {
              const next = value as TabId;
              setTab(next);
              if (next === "history") {
                setHistoryLoading(true);
                setHistoryError(null);
              }
            }}
          >
            <TabsList aria-label="测试方式">
              <TabsTrigger value="levels">烈度试推</TabsTrigger>
              <TabsTrigger
                value="history"
                onClick={() => {
                  setTab("history");
                  setHistoryLoading(true);
                  setHistoryError(null);
                }}
              >
                历史回放
              </TabsTrigger>
            </TabsList>
            <TabsContent value="levels">
              {loadError ? (
                <Alert variant="destructive" className="mb-3" role="status">
                  <AlertDescription>{loadError}</AlertDescription>
                </Alert>
              ) : null}
              <ul className="test-level-list">
                {levels.map((level) => (
                  <li key={level.id}>
                    <Card className="flex-row items-center justify-between gap-3 py-4 shadow-none">
                      <CardHeader className="px-5">
                        <CardTitle className="text-base">{notifyLevelLabel(level.id)}</CardTitle>
                        <CardDescription>{formatIntensityRange(level.min, level.max)}</CardDescription>
                      </CardHeader>
                      <CardContent className="px-5">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={pendingAction !== null || !device}
                          onClick={() => {
                            if (!device) {
                              return;
                            }
                            void runAction(`level:${level.id}`, () => simulateNotifyLevel(device.deviceKey, level.id));
                          }}
                        >
                          {pendingAction === `level:${level.id}` ? "发送中…" : "发送测试"}
                        </Button>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            </TabsContent>
            <TabsContent value="history">
              {historyError ? (
                <Alert variant="destructive" className="mb-3" role="status">
                  <AlertDescription>{historyError}</AlertDescription>
                </Alert>
              ) : null}
              {historyLoading ? <p className="test-note">正在读取历史目录…</p> : null}
              {!historyLoading && !historyError && history.length === 0 ? (
                <p className="test-note">历史目录为空。</p>
              ) : null}
              <ul className="test-history-list">
                {history.map((record) => {
                  const distance = formatDistance(record.distance_km, "km");
                  const intensity = typeof record.estimated_intensity === "number"
                    ? `估算烈度 ${record.estimated_intensity}`
                    : null;
                  return (
                    <li key={record.key}>
                      <Card className="flex-row items-center justify-between gap-3 py-4 shadow-none">
                        <CardHeader className="px-5">
                          <CardTitle className="text-base">{record.hypocenter || record.key}</CardTitle>
                          <CardDescription>
                            {record.origin_time} · M{record.magnitude} · 深度 {record.depth_km} km · 最大烈度 {record.max_intensity}
                          </CardDescription>
                          {record.note ? <CardDescription>{record.note}</CardDescription> : null}
                          {distance || intensity ? (
                            <CardDescription>{[distance && `距监测点 ${distance}`, intensity].filter(Boolean).join(" · ")}</CardDescription>
                          ) : null}
                        </CardHeader>
                        <CardContent className="px-5">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={pendingAction !== null || !device}
                            onClick={() => {
                              if (!device) {
                                return;
                              }
                              void runAction(
                                `history:${record.key}`,
                                () => simulateHistoryReplay(device.deviceKey, record.source || historySource, record.key),
                              );
                            }}
                          >
                            {pendingAction === `history:${record.key}` ? "发送中…" : "测试"}
                          </Button>
                        </CardContent>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </TabsContent>
          </Tabs>

        {actionStatus ? (
          <Alert
            className="mt-3"
            variant={actionStatus.kind === "error" ? "destructive" : "success"}
            role="status"
          >
            <AlertDescription>{actionStatus.text}</AlertDescription>
          </Alert>
        ) : null}
        </section>
      </CardContent>
      <div className="form-actions px-5 pb-5">
        <Button asChild variant="outline">
          <Link to="/devices">返回设备</Link>
        </Button>
      </div>
      </Card>
      <LegalFooter />
      </div>
    </AppShell>
  );
}
