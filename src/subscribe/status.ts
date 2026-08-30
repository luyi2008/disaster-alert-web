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

const SOURCE_LABELS: Array<{ key: keyof StatusPayload; label: string }> = [
  { key: "wolfx", label: "Wolfx" },
  { key: "fanstudio", label: "FAN Studio" },
  { key: "huania", label: "Huania" },
];

export type StatusController = {
  refreshStatus: () => Promise<void>;
};

export function bindStatus(ctx: SubscribeRuntime): StatusController {
  const { el } = ctx;
  let statusRefreshInFlight = false;

  function renderConnectedSources(data: StatusPayload | null): void {
    const labels = data
      ? SOURCE_LABELS.filter((source) => data[source.key]?.connected === true).map((source) => source.label)
      : [];
    el.alertTypeSources.textContent = labels.join(" ｜ ");
    el.alertTypeSources.hidden = labels.length === 0;
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
        renderConnectedSources(null);
        return;
      }
      renderConnectedSources(data);
    } catch {
      if (generation !== ctx.initializationGeneration) return;
      renderConnectedSources(null);
    } finally {
      statusRefreshInFlight = false;
    }
  }

  return { refreshStatus };
}
