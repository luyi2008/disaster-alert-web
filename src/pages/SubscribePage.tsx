import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { apiUrl, fetchStatus } from "../api";
import { localValidateBarkKey } from "../bark/localValidate";
import { TermsDialog } from "../components/TermsDialog";
import shell from "../subscribe/shell.html?raw";
import { mountSubscribeApp } from "../subscribe/subscribeApp";
import "../styles/base.css";
import "../styles/subscribe.css";
import "leaflet/dist/leaflet.css";

export type SubscribeLocationState = {
  barkKey?: string;
};

function barkKeyFromState(state: unknown): string | null {
  if (!state || typeof state !== "object") {
    return null;
  }
  const barkKey = (state as SubscribeLocationState).barkKey;
  if (typeof barkKey !== "string" || localValidateBarkKey(barkKey)) {
    return null;
  }
  return barkKey;
}

export function SubscribePage() {
  const location = useLocation();
  const barkKey = barkKeyFromState(location.state);
  const hostRef = useRef<HTMLDivElement>(null);
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStatus()
      .then((status) => {
        if (!cancelled) {
          setTermsAccepted(status.instance_terms_accepted);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTermsAccepted(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || termsAccepted === null || !barkKey) {
      return;
    }
    host.innerHTML = shell;
    const teardown = mountSubscribeApp(host, {
      api: apiUrl(""),
      instanceTermsAccepted: termsAccepted,
      initialBarkKey: barkKey,
    });
    return () => {
      teardown();
      host.innerHTML = "";
    };
  }, [termsAccepted, barkKey]);

  if (!barkKey) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <TermsDialog open={termsAccepted === false} />
      <div ref={hostRef} />
    </>
  );
}
