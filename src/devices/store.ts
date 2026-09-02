export type DeviceOs = "iOS" | "Android" | "iPadOS" | "Wear OS";
export type DeviceKind = "phone" | "tablet" | "watch";

export type ManagedDevice = {
  id: string;
  name: string;
  kind: DeviceKind;
  os: DeviceOs;
  online: boolean;
  notificationsEnabled: boolean;
  lastActiveAt: number;
  addedAt: number;
  barkKey: string | null;
};

const STORAGE_KEY = "disaster_devices";

function nowMinus(ms: number): number {
  return Date.now() - ms;
}

export function seedDevices(): ManagedDevice[] {
  return [
    {
      id: "iphone-15-pro",
      name: "iPhone 15 Pro",
      kind: "phone",
      os: "iOS",
      online: true,
      notificationsEnabled: true,
      lastActiveAt: nowMinus(2 * 60 * 1000),
      addedAt: nowMinus(14 * 24 * 60 * 60 * 1000),
      barkKey: "ynJ5Ft4atkMkWeo2PAvFhF",
    },
    {
      id: "pixel-8",
      name: "Pixel 8",
      kind: "phone",
      os: "Android",
      online: false,
      notificationsEnabled: false,
      lastActiveAt: nowMinus(3 * 24 * 60 * 60 * 1000),
      addedAt: nowMinus(40 * 24 * 60 * 60 * 1000),
      barkKey: null,
    },
    {
      id: "ipad-mini",
      name: "iPad mini",
      kind: "tablet",
      os: "iPadOS",
      online: true,
      notificationsEnabled: true,
      lastActiveAt: nowMinus(18 * 60 * 1000),
      addedAt: nowMinus(7 * 24 * 60 * 60 * 1000),
      barkKey: null,
    },
  ];
}

export function readDevices(): ManagedDevice[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = seedDevices();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
  try {
    const parsed = JSON.parse(raw) as ManagedDevice[];
    if (!Array.isArray(parsed)) {
      throw new Error("bad");
    }
    return parsed;
  } catch {
    const seeded = seedDevices();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

export function writeDevices(devices: ManagedDevice[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
}

export function getDevice(id: string | undefined): ManagedDevice | null {
  if (!id) {
    return null;
  }
  return readDevices().find((device) => device.id === id) ?? null;
}

export function generateDeviceCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = (n: number) =>
    Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `${pick(4)}-${pick(4)}`;
}

export function bindDevice(input: { name: string; os: DeviceOs; kind: DeviceKind }): ManagedDevice {
  const devices = readDevices();
  const device: ManagedDevice = {
    id: `dev-${Date.now().toString(36)}`,
    name: input.name,
    kind: input.kind,
    os: input.os,
    online: true,
    notificationsEnabled: true,
    lastActiveAt: Date.now(),
    addedAt: Date.now(),
    barkKey: null,
  };
  writeDevices([device, ...devices]);
  return device;
}

export function formatLastActive(timestamp: number, now = Date.now()): string {
  const delta = Math.max(0, now - timestamp);
  const minutes = Math.round(delta / 60000);
  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
