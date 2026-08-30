import { parseApiResponse } from "./http";
import type { SubscribeRuntime } from "./runtime";

type StatusSource = {
  connected?: boolean;
  messages?: number;
  reconnects?: number;
  last_message_epoch_ms?: number;
};

type StatusPayload = {
  total_subscriptions?: number;
  wolfx?: StatusSource;
  fanstudio?: StatusSource;
  huania?: StatusSource;
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
    chip: HTMLElement,
    row: HTMLElement,
    metaEl: HTMLElement,
    source: StatusSource | null | undefined,
  ): boolean {
    if (!source || source.connected !== true) {
      chip.hidden = true;
      row.hidden = true;
      metaEl.textContent = "尚未获取数据";
      return false;
    }

    chip.hidden = false;
    row.hidden = false;
    const messages = statusCount(source.messages);
    const reconnects = statusCount(source.reconnects);
    const lastMessage = formatStatusTime(source.last_message_epoch_ms);
    metaEl.textContent = `消息 ${formatStatusCount(messages)} 条 · 最近 ${lastMessage}${reconnects ? ` · 重连 ${formatStatusCount(reconnects)} 次` : ""}`;
    return true;
  }

  function setServiceStatus(label: string, connectedNames: string[] = []): void {
    el.statusLabel.textContent = label;
    const prefix = connectedNames.length ? `${connectedNames.join("、")}，` : "";
    el.serviceStatus.setAttribute("aria-label", `${prefix}${label}，查看详细服务状态`);
  }

  function setStatusDetailsUnknown(): void {
    el.statusUpdated.textContent = "暂时无法获取";
    setStatusSource(el.statusChipWolfx, el.statusSourceWolfx, el.statusWolfxMeta, null);
    setStatusSource(el.statusChipFanstudio, el.statusSourceFanstudio, el.statusFanstudioMeta, null);
    setStatusSource(el.statusChipHuania, el.statusSourceHuania, el.statusHuaniaMeta, null);
    el.statusSourceList.hidden = true;
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

      const wolfxConnected = setStatusSource(el.statusChipWolfx, el.statusSourceWolfx, el.statusWolfxMeta, data.wolfx);
      const fanstudioConnected = setStatusSource(el.statusChipFanstudio, el.statusSourceFanstudio, el.statusFanstudioMeta, data.fanstudio);
      const huaniaConnected = setStatusSource(el.statusChipHuania, el.statusSourceHuania, el.statusHuaniaMeta, data.huania);
      const connectedNames = [
        wolfxConnected ? "Wolfx" : "",
        fanstudioConnected ? "FAN Studio" : "",
        huaniaConnected ? "Huania" : "",
      ].filter(Boolean);
      el.statusSourceList.hidden = connectedNames.length === 0;
      el.statusUpdated.textContent = `更新于 ${formatStatusTime(Date.now())}`;
      setServiceStatus(`${formatStatusCount(data.total_subscriptions ?? 0)} 个订阅`, connectedNames);
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
