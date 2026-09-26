import { API_PREFIX_SUBSCRIPTION } from "../api";
import { parseApiResponse } from "./http";

type StatusSource = {
  connected?: boolean;
};

type StatusPayload = {
  wolfx?: StatusSource;
  huania?: StatusSource;
};

const SOURCE_LABELS: Array<{ key: keyof StatusPayload; label: string }> = [
  { key: "wolfx", label: "Wolfx" },
  { key: "huania", label: "Huania" },
];

export async function fetchConnectedSourceLabels(api: string): Promise<string> {
  try {
    const res = await fetch(`${api}${API_PREFIX_SUBSCRIPTION}/status`);
    const json = await parseApiResponse(res);
    const data = res.ok && json.success ? json.data as StatusPayload | undefined : null;
    if (!data || typeof data !== "object") {
      return "";
    }
    return SOURCE_LABELS.filter((source) => data[source.key]?.connected === true).map((source) => source.label).join(" ｜ ");
  } catch {
    return "";
  }
}
