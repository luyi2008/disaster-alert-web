import { parseApiResponse } from "./http";
import type { SubscribeRuntime } from "./runtime";

type StatusSource = {
  connected?: boolean;
};

type StatusPayload = {
  wolfx?: StatusSource;
  fanstudio?: StatusSource;
  huania?: StatusSource;
};

export type StatusController = {
  refreshStatus: () => Promise<void>;
};

export function bindStatus(ctx: SubscribeRuntime): StatusController {
  const { el } = ctx;
  let statusRefreshInFlight = false;

  function setSourceChip(chip: HTMLElement, source: StatusSource | null | undefined): void {
    chip.hidden = source?.connected !== true;
  }

  function hideSourceChips(): void {
    setSourceChip(el.statusChipWolfx, null);
    setSourceChip(el.statusChipFanstudio, null);
    setSourceChip(el.statusChipHuania, null);
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
      if (!data || typeof data !== "object") {
        hideSourceChips();
        return;
      }
      setSourceChip(el.statusChipWolfx, data.wolfx);
      setSourceChip(el.statusChipFanstudio, data.fanstudio);
      setSourceChip(el.statusChipHuania, data.huania);
    } catch {
      if (generation !== ctx.initializationGeneration) return;
      hideSourceChips();
    } finally {
      statusRefreshInFlight = false;
    }
  }

  return { refreshStatus };
}
