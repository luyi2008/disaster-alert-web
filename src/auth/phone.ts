const MAINLAND = /^(?:\+86)?(1[3-9]\d{9})$/;

export function normalizeMainlandPhone(raw: string): string | null {
  const match = MAINLAND.exec(raw.trim());
  return match ? `+86${match[1]}` : null;
}
