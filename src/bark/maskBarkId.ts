export function maskBarkId(barkId: string): string {
  const trimmed = barkId.trim();
  if (!trimmed) {
    return "Bark · ••••";
  }
  const tail = trimmed.slice(-3);
  return `Bark · ••••${tail}`;
}
