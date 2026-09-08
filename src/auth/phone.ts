const MAINLAND = /^(?:\+86)?(1[3-9]\d{9})$/;

export function nationalMainlandPhone(raw: string): string | null {
  const match = MAINLAND.exec(raw.trim());
  return match ? match[1] : null;
}

export function normalizeMainlandPhone(raw: string): string | null {
  const national = nationalMainlandPhone(raw);
  return national ? `+86${national}` : null;
}
