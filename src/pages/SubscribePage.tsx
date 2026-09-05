import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { apiUrl, fetchDevices, fetchStatus, matchDevice, type DeviceRecord } from "../api";
import { AppShell } from "../components/AppShell";
import { LegalFooter } from "../components/LegalFooter";
import { TermsDialog } from "../components/TermsDialog";
import { SubscribeWorkspace } from "../subscribe/SubscribeWorkspace";
import "../styles/base.css";
import "../styles/ds.css";
import "../styles/subscribe.css";
import "leaflet/dist/leaflet.css";

export function SubscribePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);
  const [device, setDevice] = useState<DeviceRecord | null>(null);
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
        const found = matchDevice(result.body.data?.devices ?? [], id);
        if (!found) {
          setMissing(true);
          return;
        }
        setDevice(found);
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

  if (!id || missing) {
    return <Navigate to="/devices" replace />;
  }

  return (
    <>
      <TermsDialog open={termsAccepted === false} />
      <AppShell
        title="配置订阅"
        description={device ? `为「${device.name}」选择监测地点和预警规则。` : "选择监测地点和预警规则。"}
      >
        <div className="subscribe-workspace">
          <section className="panel">
            {device && termsAccepted !== null ? (
              <SubscribeWorkspace
                api={apiUrl("")}
                instanceTermsAccepted={termsAccepted}
                deviceKey={device.deviceKey}
                onUnauthorized={() => navigate("/login", { replace: true })}
                onMissingDevice={() => navigate("/devices", { replace: true })}
              />
            ) : null}
          </section>
          <LegalFooter />
        </div>
      </AppShell>
    </>
  );
}
