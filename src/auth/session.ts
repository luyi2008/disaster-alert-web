import { apiUrl } from "../api";

export type AuthUser = {
  id: string;
  name?: string | null;
  phoneNumber?: string | null;
};

export type AuthSession = { user: AuthUser } | null;

export async function bffFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(apiUrl(path), { ...init, headers, credentials: "include" });
}

export async function getSession(): Promise<AuthSession> {
  const response = await bffFetch("/api/auth/get-session");
  if (!response.ok) {
    return null;
  }
  const body = await response.json() as { user?: AuthUser } | null;
  if (!body || typeof body !== "object" || !body.user || typeof body.user.id !== "string") {
    return null;
  }
  return { user: body.user };
}

export async function signOut(): Promise<void> {
  await bffFetch("/api/auth/sign-out", { method: "POST" });
}
