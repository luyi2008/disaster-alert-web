const ACCOUNT_KEY = "disaster_account";

export type AccountSession = {
  method: "phone" | "wechat" | "alipay" | "google";
  label: string;
  phone?: string;
};

export function readAccount(): AccountSession | null {
  const raw = localStorage.getItem(ACCOUNT_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as AccountSession;
    if (!parsed || typeof parsed.label !== "string" || !parsed.method) {
      localStorage.removeItem(ACCOUNT_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(ACCOUNT_KEY);
    return null;
  }
}

export function writeAccount(account: AccountSession): void {
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
}

export function clearAccount(): void {
  localStorage.removeItem(ACCOUNT_KEY);
}
