import { localValidateBarkKey } from "../bark/localValidate";
import { readCachedBarkKey } from "../bark/session";

export type SubscribeLocationState = {
  barkKey?: string;
};

export function barkKeyFromState(state: unknown): string | null {
  if (!state || typeof state !== "object") {
    return null;
  }
  const barkKey = (state as SubscribeLocationState).barkKey;
  if (typeof barkKey !== "string" || localValidateBarkKey(barkKey)) {
    return null;
  }
  return barkKey;
}

export function resolveBarkKey(state: unknown): string | null {
  return barkKeyFromState(state) ?? readCachedBarkKey();
}
