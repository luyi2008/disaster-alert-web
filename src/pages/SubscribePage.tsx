import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { apiUrl, fetchStatus } from "../api";
import { clearCachedBarkKey } from "../bark/session";
import { DeviceIdentity } from "../components/DeviceIdentity";
import { LegalFooter } from "../components/LegalFooter";
import { TermsDialog } from "../components/TermsDialog";
import { resolveBarkKey, type SubscribeLocationState } from "../subscribe/barkKeyState";
import bodyHtml from "../subscribe/body.html?raw";
import headerHtml from "../subscribe/header.html?raw";
import { mountSubscribeApp } from "../subscribe/subscribeApp";
import "../styles/base.css";
import "../styles/subscribe.css";
import "leaflet/dist/leaflet.css";

export type { SubscribeLocationState };

export function SubscribePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const barkKey = resolveBarkKey(location.state);
  const rootRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
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
    const root = rootRef.current;
    const header = headerRef.current;
    const body = bodyRef.current;
    if (!root || !header || !body || termsAccepted === null || !barkKey) {
      return;
    }
    header.innerHTML = headerHtml;
    body.innerHTML = bodyHtml;
    const app = mountSubscribeApp(root, {
      api: apiUrl(""),
      instanceTermsAccepted: termsAccepted,
      deviceKey: barkKey,
      onInvalidBarkKey: () => {
        clearCachedBarkKey();
        navigate("/", { replace: true });
      },
    });
    return () => {
      app.teardown();
      header.innerHTML = "";
      body.innerHTML = "";
    };
  }, [termsAccepted, barkKey, navigate]);

  if (!barkKey) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <TermsDialog open={termsAccepted === false} />
      <main ref={rootRef}>
        <div className="app-bar">
          <div className="shell-slot" ref={headerRef} />
          <DeviceIdentity barkId={barkKey} />
        </div>
        <section className="panel">
          <div className="shell-slot" ref={bodyRef} />
        </section>
        <LegalFooter />
      </main>
    </>
  );
}
