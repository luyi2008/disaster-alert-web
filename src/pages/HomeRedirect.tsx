import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getSession } from "../auth/session";

export function HomeRedirect() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSession()
      .then((session) => {
        if (!cancelled) {
          setTarget(session ? "/devices" : "/login");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTarget("/login");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!target) {
    return <p className="account-loading">正在打开…</p>;
  }
  return <Navigate to={target} replace />;
}
