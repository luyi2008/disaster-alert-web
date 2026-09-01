import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { apiUrl, fetchDevices, fetchStatus } from "../api";
import { DeviceIdentity } from "../components/DeviceIdentity";
import { LegalFooter } from "../components/LegalFooter";
import { TermsDialog } from "../components/TermsDialog";
import bodyHtml from "../subscribe/body.html?raw";
import headerHtml from "../subscribe/header.html?raw";
import { mountSubscribeApp } from "../subscribe/subscribeApp";
import "../styles/base.css";
import "../styles/subscribe.css";
import "leaflet/dist/leaflet.css";

export function SubscribePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

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
    if (!id) {
      return;
    }
    let cancelled = false;
    fetchDevices()
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.status === 401) {
          navigate("/login", { replace: true });
          return;
        }
        const device = result.body.data?.devices.find((row) => row.id === id);
        if (!device) {
          setMissing(true);
          return;
        }
        setDeviceName(device.name);
      })
      .catch(() => {
        if (!cancelled) {
          setMissing(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  useEffect(() => {
    const root = rootRef.current;
    const header = headerRef.current;
    const body = bodyRef.current;
    if (!root || !header || !body || termsAccepted === null || !id || !deviceName) {
      return;
    }
    header.innerHTML = headerHtml;
    body.innerHTML = bodyHtml;
    const app = mountSubscribeApp(root, {
      api: apiUrl(""),
      instanceTermsAccepted: termsAccepted,
      deviceId: id,
      onUnauthorized: () => navigate("/login", { replace: true }),
      onMissingDevice: () => navigate("/devices", { replace: true }),
    });
    return () => {
      app.teardown();
      header.innerHTML = "";
      body.innerHTML = "";
    };
  }, [termsAccepted, id, deviceName, navigate]);

  if (!id || missing) {
    return <Navigate to="/devices" replace />;
  }

  return (
    <>
      <TermsDialog open={termsAccepted === false} />
      <main ref={rootRef}>
        <div className="app-bar">
          <div className="shell-slot" ref={headerRef} />
          {deviceName ? <DeviceIdentity deviceId={id} deviceName={deviceName} /> : null}
        </div>
        <section className="panel">
          <div className="shell-slot" ref={bodyRef} />
        </section>
        <LegalFooter />
      </main>
    </>
  );
}
