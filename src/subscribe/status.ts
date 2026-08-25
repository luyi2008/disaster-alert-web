import { parseApiResponse } from "./http";
import type { SubscribeRuntime } from "./runtime";

type StatusSource = {
  connected?: boolean;
  messages?: number;
  reconnects?: number;
  last_message_epoch_ms?: number;
  notifications_succeeded?: number;
  notifications_failed?: number;
};

type StatusPayload = {
  total_subscriptions?: number;
  wolfx?: StatusSource;
  fanstudio?: StatusSource;
  huania?: StatusSource;
  durable?: Record<string, number>;
  ready_queues?: Record<string, { depth?: number }>;
};

export type StatusController = {
  refreshStatus: () => Promise<void>;
};

export function bindStatus(ctx: SubscribeRuntime): StatusController {
  const { el, ownerDocument } = ctx;
  let statusRefreshInFlight = false;
  let lastStatusRefreshAt = 0;
  let statusWasOpenOnPointerDown = false;
  let focusOutTimer: ReturnType<typeof setTimeout> | null = null;

  function setStatusDot(dot: HTMLElement, state = "unknown"): void {
    dot.classList.remove("online", "partial", "offline");
    if (state !== "unknown") dot.classList.add(state);
  }

  function formatStatusCount(value: number): string {
    return new Intl.NumberFormat("zh-CN").format(Number.isInteger(value) && value >= 0 ? value : 0);
  }

  function statusCount(value: unknown): number {
    return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : 0;
  }

  function formatStatusTime(epochMs: unknown): string {
    if (typeof epochMs !== "number" || !Number.isFinite(epochMs) || epochMs <= 0) return "尚无消息";
    return new Date(epochMs).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  function setStatusSource(
    dot: HTMLElement,
    stateEl: HTMLElement,
    metaEl: HTMLElement,
    source: StatusSource | null | undefined,
  ): { delivered: number; failed: number } {
    if (!source || typeof source !== "object") {
      setStatusDot(dot);
      stateEl.textContent = "未知";
      metaEl.textContent = "尚未获取数据";
      return { delivered: 0, failed: 0 };
    }

    const connected = source.connected === true;
    setStatusDot(dot, connected ? "online" : "offline");
    stateEl.textContent = connected ? "已连接" : "未连接";
    const messages = statusCount(source.messages);
    const reconnects = statusCount(source.reconnects);
    const lastMessage = formatStatusTime(source.last_message_epoch_ms);
    metaEl.textContent = `消息 ${formatStatusCount(messages)} 条 · 最近 ${lastMessage}${reconnects ? ` · 重连 ${formatStatusCount(reconnects)} 次` : ""}`;
    return {
      delivered: statusCount(source.notifications_succeeded),
      failed: statusCount(source.notifications_failed),
    };
  }

  function setServiceStatus(label: string, state = "unknown"): void {
    el.statusLabel.textContent = label;
    el.serviceStatus.setAttribute("aria-label", `${label}，查看详细服务状态`);
    setStatusDot(el.statusDot, state);
  }

  function setStatusDetailsUnknown(): void {
    el.statusUpdated.textContent = "暂时无法获取";
    setStatusSource(el.statusWolfxDot, el.statusWolfxState, el.statusWolfxMeta, null);
    setStatusSource(el.statusFanstudioDot, el.statusFanstudioState, el.statusFanstudioMeta, null);
    setStatusSource(el.statusHuaniaDot, el.statusHuaniaState, el.statusHuaniaMeta, null);
    el.statusSubscriptions.textContent = "--";
    el.statusPending.textContent = "--";
    el.statusDelivered.textContent = "--";
    el.statusFailed.textContent = "--";
    el.statusBacklog.textContent = "事件 -- · 匹配 -- · 投递 -- · 重试 -- · 订阅确认 --";
  }

  function openStatusDetails(): void {
    el.statusShell.classList.add("is-open");
    el.serviceStatus.setAttribute("aria-expanded", "true");
    if (Date.now() - lastStatusRefreshAt > 15_000) void refreshStatus();
  }

  function closeStatusDetails(): void {
    el.statusShell.classList.remove("is-open");
    el.serviceStatus.setAttribute("aria-expanded", "false");
  }

  async function refreshStatus(): Promise<void> {
    if (statusRefreshInFlight) return;
    statusRefreshInFlight = true;
    const generation = ctx.initializationGeneration;
    try {
      const res = await fetch(`${ctx.api}/api/status`);
      if (generation !== ctx.initializationGeneration) return;
      const json = await parseApiResponse(res);
      const data = res.ok && json.success ? json.data as StatusPayload | undefined : null;
      if (!data || !Number.isInteger(data.total_subscriptions)) {
        setServiceStatus("状态未知");
        setStatusDetailsUnknown();
        return;
      }

      const sources = [data.wolfx, data.fanstudio, data.huania];
      const connectedSources = sources.filter((source) => source?.connected === true).length;
      const sourceLabel = connectedSources === sources.length
        ? "数据源正常"
        : connectedSources > 0 ? `数据源 ${connectedSources}/${sources.length}` : "数据源离线";
      const state = connectedSources === sources.length ? "online" : connectedSources > 0 ? "partial" : "offline";
      const pending = data.durable && typeof data.durable === "object"
        ? Object.entries(data.durable)
          .filter(([key, value]) => key.endsWith("_pending") && Number.isFinite(value))
          .reduce((sum, [, value]) => sum + value, 0)
        : 0;
      setServiceStatus(
        `${sourceLabel} · ${data.total_subscriptions} 个订阅`,
        state,
      );
      const wolfxNotifications = setStatusSource(el.statusWolfxDot, el.statusWolfxState, el.statusWolfxMeta, data.wolfx);
      const fanstudioNotifications = setStatusSource(el.statusFanstudioDot, el.statusFanstudioState, el.statusFanstudioMeta, data.fanstudio);
      const huaniaNotifications = setStatusSource(el.statusHuaniaDot, el.statusHuaniaState, el.statusHuaniaMeta, data.huania);
      const durable = data.durable && typeof data.durable === "object" ? data.durable : {};
      const readyQueues = data.ready_queues && typeof data.ready_queues === "object" ? data.ready_queues : {};
      const readyQueueDepth = (name: string) => statusCount(readyQueues[name]?.depth);
      el.statusUpdated.textContent = `更新于 ${formatStatusTime(Date.now())}`;
      const subscriptionCount = data.total_subscriptions ?? 0;
      el.statusSubscriptions.textContent = formatStatusCount(subscriptionCount);
      el.statusPending.textContent = formatStatusCount(pending);
      el.statusDelivered.textContent = formatStatusCount(wolfxNotifications.delivered + fanstudioNotifications.delivered + huaniaNotifications.delivered);
      el.statusFailed.textContent = formatStatusCount(wolfxNotifications.failed + fanstudioNotifications.failed + huaniaNotifications.failed);
      el.statusBacklog.textContent = `事件 ${formatStatusCount(statusCount(durable.inbox_pending))} · 匹配 ${formatStatusCount(statusCount(durable.match_jobs_pending))} · 投递 ${formatStatusCount(statusCount(durable.delivery_batches_pending))} · 重试 ${formatStatusCount(statusCount(durable.retries_pending))} · 订阅确认 ${formatStatusCount(statusCount(durable.subscription_confirmations_pending))}；内存队列 事件 ${formatStatusCount(readyQueueDepth("inbox"))} · 匹配 ${formatStatusCount(readyQueueDepth("matching"))} · 投递 ${formatStatusCount(readyQueueDepth("delivery"))}`;
    } catch {
      if (generation !== ctx.initializationGeneration) return;
      setServiceStatus("状态未知");
      setStatusDetailsUnknown();
    } finally {
      lastStatusRefreshAt = Date.now();
      statusRefreshInFlight = false;
    }
  }

  ctx.cleanup.listen(el.serviceStatus, "pointerdown", () => {
    statusWasOpenOnPointerDown = el.statusShell.classList.contains("is-open");
  });
  ctx.cleanup.listen(el.serviceStatus, "click", (event) => {
    const mouseEvent = event as MouseEvent;
    const shouldClose = mouseEvent.detail === 0
      ? el.statusShell.classList.contains("is-open")
      : statusWasOpenOnPointerDown;
    if (shouldClose) closeStatusDetails();
    else openStatusDetails();
  });
  ctx.cleanup.listen(el.statusShell, "mouseenter", () => openStatusDetails());
  ctx.cleanup.listen(el.statusShell, "mouseleave", () => {
    if (!el.statusShell.contains(ownerDocument.activeElement)) closeStatusDetails();
  });
  ctx.cleanup.listen(el.statusShell, "focusin", () => openStatusDetails());
  ctx.cleanup.listen(el.statusShell, "focusout", () => {
    if (focusOutTimer) clearTimeout(focusOutTimer);
    focusOutTimer = setTimeout(() => {
      if (!el.statusShell.contains(ownerDocument.activeElement)) closeStatusDetails();
    }, 0);
  });
  ctx.cleanup.listen(ownerDocument, "pointerdown", (event) => {
    if (!el.statusShell.contains(event.target as Node)) closeStatusDetails();
  });
  ctx.cleanup.listen(ownerDocument, "keydown", (event) => {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.key !== "Escape" || !el.statusShell.classList.contains("is-open")) return;
    closeStatusDetails();
    el.serviceStatus.blur();
  });
  ctx.cleanup.add(() => {
    if (focusOutTimer) clearTimeout(focusOutTimer);
  });

  return { refreshStatus };
}
