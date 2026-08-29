import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { DeviceIdentity } from "../components/DeviceIdentity";
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
import { formatAlertSummaries, formatDraftUpdatedAt, formatTarget } from "../simulate/subscriptionPreview";
import { barkKeyFromState } from "../subscribe/barkKeyState";
import { readDraftUpdatedAt, restoreDraftFromStorage } from "../subscribe/draft";
import "../styles/base.css";
import "../styles/subscribe.css";
import "../styles/test.css";

type TabId = "levels" | "history";

type ActionStatus = {
  kind: "success" | "error";
  text: string;
};

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
  const barkKey = barkKeyFromState(location.state);
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
    setHistoryError(null);
    setHistoryLoading(true);
    fetchHistoryCatalog(barkKey)
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
  }, [barkKey, tab]);

  if (!barkKey) {
    return <Navigate to="/" replace />;
  }

  const alertSummaries = formatAlertSummaries(draft);
  const hasDraftContent = draft.targets.length > 0 || alertSummaries.length > 0;

  async function runAction(actionId: string, send: () => ReturnType<typeof simulateNotifyLevel>): Promise<void> {
    setPendingAction(actionId);
    setActionStatus(null);
    try {
      const { status, body } = await send();
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
  }

  return (
    <main className="test-page">
      <header>
        <h1>发个通知</h1>
        <p className="subhead">用已保存订阅做旁路测试推送，不会写入真实预警队列</p>
      </header>
      <section className="panel">
        <DeviceIdentity barkId={barkKey} currentPage="test" />
        <section className="test-summary" aria-labelledby="test-summary-heading">
          <h2 id="test-summary-heading">当前订阅</h2>
          {!hasDraftContent ? (
            <p className="test-note">本浏览器还没有订阅草稿。模拟接口只认本实例已保存的订阅，请先回到订阅页保存。</p>
          ) : (
            <p className="test-note">以下来自本机草稿，不一定等于服务端已生效订阅。未保存时测试会返回 404。</p>
          )}
          <dl className="test-summary-list">
            <div>
              <dt>Bark Key</dt>
              <dd>{barkKey}</dd>
            </div>
            <div>
              <dt>Bark 服务器</dt>
              <dd>{barkUrl || "尚未获取"}</dd>
            </div>
            <div>
              <dt>订阅位置</dt>
              <dd>
                {draft.targets.length
                  ? (
                      <ul>
                        {draft.targets.map((target) => (
                          <li key={target.id}>{formatTarget(target)}</li>
                        ))}
                      </ul>
                    )
                  : "尚未选择地点"}
              </dd>
            </div>
            <div>
              <dt>订阅项目与通知规则</dt>
              <dd>
                {alertSummaries.length
                  ? (
                      <ul>
                        {alertSummaries.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )
                  : "尚未配置规则"}
              </dd>
            </div>
            <div>
              <dt>更新时间</dt>
              <dd>{formatDraftUpdatedAt(draftUpdatedAt)}</dd>
            </div>
          </dl>
        </section>

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
            推送等级
          </button>
          <button
            type="button"
            role="tab"
            id="tab-history"
            aria-controls="panel-history"
            aria-selected={tab === "history"}
            className={tab === "history" ? "is-active" : undefined}
            onClick={() => setTab("history")}
          >
            历史数据
          </button>
        </div>

        {tab === "levels" ? (
          <section
            className="test-panel"
            role="tabpanel"
            id="panel-levels"
            aria-labelledby="tab-levels"
          >
            <p className="test-note">等级来自服务端地震预警烈度带。后端增删级别后刷新本页即可同步。</p>
            {loadError ? <p className="test-status is-error" role="status">{loadError}</p> : null}
            <ul className="test-level-list">
              {levels.map((level) => (
                <li key={level.id} className="test-card">
                  <div>
                    <strong>{notifyLevelLabel(level.id)}</strong>
                    <p>{formatIntensityRange(level.min, level.max)} · {level.id}</p>
                  </div>
                  <button
                    type="button"
                    className="primary"
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
                      className="primary"
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
    </main>
  );
}
