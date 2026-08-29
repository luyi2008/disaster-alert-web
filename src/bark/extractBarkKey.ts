export const BARK_KEY_PATTERN = /^[A-Za-z0-9]{22}$/;

const SKIP_SEGMENTS = new Set(["push", "bark"]);

export function extractBarkKey(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (BARK_KEY_PATTERN.test(trimmed)) {
    return trimmed;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  for (const segment of url.pathname.split("/")) {
    if (!segment) {
      continue;
    }
    let decoded = segment;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      decoded = segment;
    }
    if (SKIP_SEGMENTS.has(decoded.toLowerCase())) {
      continue;
    }
    if (BARK_KEY_PATTERN.test(decoded)) {
      return decoded;
    }
  }
  return null;
}
