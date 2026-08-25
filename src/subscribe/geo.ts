import type { Coordinates, SubscriptionTarget } from "./types";

export function createTarget(): SubscriptionTarget {
  const id = window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    label: "",
    point: { latitude: "", longitude: "" },
    region: { province: "", city: "", district: "" },
  };
}

export function parseCoordinate(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

export function validCoordinate(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

export function targetCoordinates(target: SubscriptionTarget | null | undefined): Coordinates | null {
  const latitude = parseCoordinate(target?.point?.latitude);
  const longitude = parseCoordinate(target?.point?.longitude);
  return latitude !== null && longitude !== null && validCoordinate(latitude, longitude)
    ? { latitude, longitude }
    : null;
}

export function cloneTarget(target: SubscriptionTarget): SubscriptionTarget {
  return {
    id: target.id,
    label: String(target.label || ""),
    point: {
      latitude: String(target.point?.latitude ?? ""),
      longitude: String(target.point?.longitude ?? ""),
    },
    region: {
      province: String(target.region?.province || ""),
      city: String(target.region?.city || ""),
      district: String(target.region?.district || ""),
    },
  };
}

export function targetLabel(target: SubscriptionTarget | null | undefined): string {
  const label = String(target?.label || "").trim();
  if (label) return label;
  const coordinates = targetCoordinates(target);
  return coordinates ? `${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}` : "未命名地点";
}

export function targetRegion(target: SubscriptionTarget | null | undefined): string {
  return [target?.region?.province, target?.region?.city, target?.region?.district]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" · ");
}

export function validateLocations(locations: SubscriptionTarget[]): string {
  const used = new Set<string>();
  for (const [index, location] of locations.entries()) {
    const coordinates = targetCoordinates(location);
    if (!coordinates) return `监测地点 ${index + 1} 尚未选择有效位置`;
    const coordinateKey = `${coordinates.latitude.toFixed(4)},${coordinates.longitude.toFixed(4)}`;
    if (used.has(coordinateKey)) return `监测地点 ${index + 1} 与其他地点坐标重复`;
    used.add(coordinateKey);
    for (const [label, value] of [
      ["名称", location.label],
      ["省/州", location.region?.province],
      ["城市", location.region?.city],
      ["区/县", location.region?.district],
    ] as const) {
      if ([...String(value || "").trim()].length > 80) return `监测地点 ${index + 1} 的${label}最多 80 个字符`;
    }
  }
  return "";
}
