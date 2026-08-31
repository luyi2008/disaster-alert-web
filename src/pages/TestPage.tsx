import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { maskBarkId } from "../bark/maskBarkId";
import { maybeExpireBarkSession } from "../bark/session";
import { AppBrand } from "../components/AppBrand";
import { DeviceIdentity } from "../components/DeviceIdentity";
import { LegalFooter } from "../components/LegalFooter";
import {
  fetchBarkUrls,
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
  type RuleCardTone,
} from "../simulate/subscriptionPreview";
import { resolveBarkKey } from "../subscribe/barkKeyState";
import { readDraftUpdatedAt, restoreDraftFromStorage } from "../subscribe/draft";
import "../styles/base.css";
import "../styles/subscribe.css";
import "../styles/test.css";

type TabId = "levels" | "history";

type ActionStatus = {
  kind: "success" | "error";
  text: string;
};

function StatusIcon({ name }: { name: "cloud" | "server" | "pin" }) {
  if (name === "cloud") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 18h10a4 4 0 0 0 .4-8 6 6 0 0 0-11.6 1.5A3.5 3.5 0 0 0 7 18Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "server") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="4" width="16" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
        <rect x="4" y="14" width="16" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="8" cy="7" r="1" fill="currentColor" />
        <circle cx="8" cy="17" r="1" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21s7-6.2 7-11.2A7 7 0 0 0 5 9.8C5 14.8 12 21 12 21Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function RuleGlyph({ category }: { category: string }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none" as const };
  if (category === "earthquake_warning") {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M3 12h3.2l2.4 7 4.8-14 2.4 7H21" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (category === "earthquake_report") {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M5 19V10M10 19V5M15 19v-7M20 19V8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (category === "weather_warning") {
    return (
      <svg {...common} aria-hidden="true">
        <circle cx="10" cy="10" r="3.2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 16h8.5a3 3 0 0 0 .2-6 5 5 0 0 0-9.4 1.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (category === "tsunami") {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M4 16c2.2-2 4.2-3 6-3s3.8 1 6 3 4.2 3 6 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M4 10c2.2-2 4.2-3 6-3s3.8 1 6 3 4.2 3 6 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden="true">
      <path d="M12 5c2.8 2.4 4.5 5.2 4.5 7.6A4.5 4.5 0 0 1 7.5 12.6C7.5 10.2 9.2 7.4 12 5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function RuleCard({ card }: { card: AlertRuleCard }) {
  return (
    <li className={`rule-card is-${card.tone}`}>
      <span className="rule-card-bar" aria-hidden="true" />
      <RuleGlyph category={card.category} />
      <strong>{card.title}</strong>
      {card.badge ? (
        <span className={`rule-badge is-${card.badge.tone}`}>{card.badge.label}</span>
      ) : null}
      {card.metric ? <span className="rule-metric">{card.metric}</span> : null}
    </li>
  );
}

function levelTone(id: string): RuleCardTone {
  if (id === "critical") {
    return "warn";
  }
  if (id === "active") {
    return "primary";
  }
  return "quiet";
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
  const location = useLocation();
  const navigate = useNavigate();
  const barkKey = resolveBarkKey(location.state);
  const draft = useMemo(() => restoreDraftFromStorage(), []);
  const draftUpdatedAt = useMemo(() => readDraftUpdatedAt(), []);
  const [barkUrl, setBarkUrl] = useState(draft.bark_url);
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
    if (!barkKey) {
      return;
    }
    let cancelled = false;
    Promise.all([fetchBarkUrls(), fetchSubscriptionOptions()])
      .then(([urls, options]) => {
        if (cancelled) {
          return;
        }
        setBarkUrl(urls[0] || draft.bark_url);
        setLevels(notifyLevelsFromOptions(options));
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
  }, [barkKey, draft.bark_url]);

  useEffect(() => {
    if (!barkKey || tab !== "history") {
      return;
    }
    let cancelled = false;
    fetchHistoryCatalog(barkKey)
      .then(async ({ status, body }) => {
        if (cancelled) {
          return;
        }
        if (await maybeExpireBarkSession(barkKey, status, "bearer")) {
          if (!cancelled) {
            navigate("/", { replace: true });
          }
          return;
        }
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
  }, [barkKey, tab, navigate]);

  if (!barkKey) {
    return <Navigate to="/" replace />;
  }

  const alertCards = alertRuleCards(draft);
  const hasDraftContent = draft.targets.length > 0 || alertCards.length > 0;

  const runAction = async (actionId: string, send: () => ReturnType<typeof simulateNotifyLevel>): Promise<void> => {
    setPendingAction(actionId);
    setActionStatus(null);
    try {
      const { status, body } = await send();
      if (await maybeExpireBarkSession(barkKey, status, "bearer")) {
        navigate("/", { replace: true });
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
    <main className="test-page">
      <div className="app-bar">
        <AppBrand />
        <DeviceIdentity barkId={barkKey} currentPage="test" />
      </div>
      <section className="panel test-sheet">
        <div className="test-status-strip" aria-label="设备状态">
          <div className="test-status-cell">
            <StatusIcon name="cloud" />
            <span title={barkKey}>{maskBarkId(barkKey)}</span>
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
                  <StatusIcon name="pin" />
                  {formatTargetChip(target)}
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

        {!hasDraftContent ? (
          <p className="test-note">本浏览器还没有订阅草稿。模拟接口只认本实例已保存的订阅，请先回到订阅页保存。</p>
        ) : null}

        <section className="test-block" aria-labelledby="test-priority-heading">
          <h2 id="test-priority-heading">Push Priority</h2>
          <div className="test-tabs" role="tablist" aria-label="测试方式">
            <button
              type="button"
              role="tab"
              id="tab-levels"
              aria-controls="panel-levels"
              aria-selected={tab === "levels"}
              className={tab === "levels" ? "is-active" : undefined}
              onClick={() => setTab("levels")}
            >
              烈度试推
            </button>
            <button
              type="button"
              role="tab"
              id="tab-history"
              aria-controls="panel-history"
              aria-selected={tab === "history"}
              className={tab === "history" ? "is-active" : undefined}
              onClick={() => {
                setTab("history");
                setHistoryLoading(true);
                setHistoryError(null);
              }}
            >
              历史回放
            </button>
          </div>

        {tab === "levels" ? (
          <section
            className="test-panel"
            role="tabpanel"
            id="panel-levels"
            aria-labelledby="tab-levels"
          >
            {loadError ? <p className="test-status is-error" role="status">{loadError}</p> : null}
            <ul className="test-level-list">
              {levels.map((level) => (
                <li key={level.id} className={`test-card is-${levelTone(level.id)}`}>
                  <div>
                    <strong>{notifyLevelLabel(level.id)}</strong>
                    <p>{formatIntensityRange(level.min, level.max)}</p>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={pendingAction !== null}
                    onClick={() => runAction(`level:${level.id}`, () => simulateNotifyLevel(barkKey, level.id))}
                  >
                    {pendingAction === `level:${level.id}` ? "发送中…" : "发送测试"}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section
            className="test-panel"
            role="tabpanel"
            id="panel-history"
            aria-labelledby="tab-history"
          >
            <p className="test-note">目录由 `/api/history` 下发，当前来源 {historySource}。每条可回放到当前设备。</p>
            {historyError ? <p className="test-status is-error" role="status">{historyError}</p> : null}
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
                  <li key={record.key} className="test-card">
                    <div>
                      <strong>{record.hypocenter || record.key}</strong>
                      <p>
                        {record.origin_time} · M{record.magnitude} · 深度 {record.depth_km} km · 最大烈度 {record.max_intensity}
                      </p>
                      {record.note ? <p>{record.note}</p> : null}
                      {distance || intensity ? (
                        <p>{[distance && `距监测点 ${distance}`, intensity].filter(Boolean).join(" · ")}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={pendingAction !== null}
                      onClick={() => runAction(
                        `history:${record.key}`,
                        () => simulateHistoryReplay(barkKey, record.source || historySource, record.key),
                      )}
                    >
                      {pendingAction === `history:${record.key}` ? "发送中…" : "测试"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {actionStatus ? (
          <p className={`test-status is-${actionStatus.kind}`} role="status">{actionStatus.text}</p>
        ) : null}
        </section>
      </section>
      <p className="test-updated">上次更新 {formatDraftUpdatedAt(draftUpdatedAt)}</p>
      <LegalFooter />
    </main>
  );
}
