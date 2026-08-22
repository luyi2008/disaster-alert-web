import { useEffect, useState } from "react";
import { fetchIncidentDetail, type IncidentDetail } from "../api";

export type DetailStatus = "loading" | "ready" | "not_found" | "unavailable" | "error";

export function useIncidentDetail(incidentId: string, token: string) {
  const [status, setStatus] = useState<DetailStatus>("loading");
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [message, setMessage] = useState("请从原始灾害通知重新进入。");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchIncidentDetail(incidentId, token)
      .then(({ status: httpStatus, body }) => {
        if (cancelled) {
          return;
        }
        if (httpStatus === 404) {
          setStatus("not_found");
          setMessage(body.message || "请从原始灾害通知重新进入。");
          return;
        }
        if (httpStatus === 503) {
          setStatus("unavailable");
          setMessage(body.message || "当前访问较多，请稍后重试。");
          return;
        }
        if (!body.success || !body.data) {
          setStatus("error");
          setMessage(body.message || "请稍后重新尝试。");
          return;
        }
        setDetail(body.data);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
          setMessage("请稍后重新尝试。");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [incidentId, token]);

  return { status, detail, message };
}
