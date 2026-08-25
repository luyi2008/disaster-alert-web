import { useEffect, useRef, useState } from "react";
import { apiUrl, fetchStatus } from "../api";
import { TermsDialog } from "../components/TermsDialog";
import shell from "../subscribe/shell.html?raw";
import { mountSubscribeApp } from "../subscribe/subscribeApp";
import "../styles/subscribe.css";
import "leaflet/dist/leaflet.css";

export function SubscribePage() {
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
    if (!host || termsAccepted === null) {
      return;
    }
    host.innerHTML = shell;
    const teardown = mountSubscribeApp(host, {
      api: apiUrl(""),
      instanceTermsAccepted: termsAccepted,
    });
    return () => {
      teardown();
      host.innerHTML = "";
    };
  }, [termsAccepted]);

  return (
    <>
      <TermsDialog open={termsAccepted === false} />
      <div ref={hostRef} />
    </>
  );
}
