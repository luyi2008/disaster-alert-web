import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { getSession, type AuthSession } from "./session";

export function RequireSession({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getSession()
      .then((value) => {
        if (!cancelled) {
          setSession(value);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSession(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (session === undefined) {
    return <p className="account-loading">正在确认登录…</p>;
  }
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
