import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { checkDeviceKey, remoteStatusMessage } from "../bark/checkDeviceKey";
import { extractBarkKey } from "../bark/extractBarkKey";
import { localValidateBarkKey, localValidateMessage } from "../bark/localValidate";
import { readCachedBarkKey, writeCachedBarkKey } from "../bark/session";
import "../styles/base.css";
import "../styles/entry.css";

type RemoteStatus = {
  key: string;
  kind: "ok" | "error";
  text: string;
};

export function BarkKeyPage() {
  const navigate = useNavigate();
  const cachedKey = readCachedBarkKey();
  const [raw, setRaw] = useState("");
  const [remote, setRemote] = useState<RemoteStatus | null>(null);

  const trimmed = raw.trim();
  const extracted = trimmed ? extractBarkKey(raw) : null;
  const localFailure = extracted ? localValidateBarkKey(extracted) : trimmed ? "empty" : null;
  const localMessage = !trimmed
    ? null
    : extracted
      ? (localFailure ? localValidateMessage(localFailure) : null)
      : "无法从内容中提取 Bark Key";
  const awaitingRemote = Boolean(extracted && !localFailure);
  const remoteForKey = awaitingRemote && remote?.key === extracted ? remote : null;
  const checking = awaitingRemote && !remoteForKey;
  const statusText = localMessage ?? (checking ? "正在校验…" : remoteForKey?.text ?? null);
  const statusKind = localMessage ? "error" : checking ? "checking" : remoteForKey?.kind ?? "idle";
  const canContinue = Boolean(extracted && !localFailure && remoteForKey?.kind === "ok");

  useEffect(() => {
    if (!extracted || localValidateBarkKey(extracted)) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void checkDeviceKey(extracted, controller.signal)
        .then((result) => {
          if (result.valid && result.registered) {
            setRemote({ key: extracted, kind: "ok", text: remoteStatusMessage(result) });
          } else {
            setRemote({ key: extracted, kind: "error", text: remoteStatusMessage(result) });
          }
        })
        .catch((error: { name?: string }) => {
          if (error?.name === "AbortError") {
            return;
          }
          setRemote({ key: extracted, kind: "error", text: "无法校验 Bark Key，请稍后重试" });
        });
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [extracted]);

  if (cachedKey) {
    return <Navigate to="/subscribe" replace state={{ barkKey: cachedKey }} />;
  }

  return (
    <div className="entry-page">
      <p className="entry-brand">发个通知</p>
      <main className="entry-main">
        <div className="entry-mark" aria-hidden="true">
          <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
            <rect x="24" y="16" width="24" height="40" rx="5" stroke="currentColor" strokeWidth="1.75" />
            <rect x="28" y="21" width="16" height="24" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="36" cy="50" r="1.75" fill="currentColor" />
            <circle cx="48" cy="22" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
            <circle cx="48" cy="22" r="5.5" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
            <path d="M50.2 18.8 56 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <h1>连接你的 Bark</h1>
        <p className="entry-lead">从 Bark App 复制测试推送链接，粘贴到这里完成设备连接。</p>
        <form
          className="entry-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canContinue || !extracted) {
              return;
            }
            writeCachedBarkKey(extracted);
            navigate("/subscribe", { state: { barkKey: extracted } });
          }}
        >
          <div>
            <label htmlFor="bark-test-link">测试链接或 Bark Key</label>
            <input
              id="bark-test-link"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={raw}
              placeholder="粘贴测试链接或 22 位 Bark Key"
              onChange={(event) => setRaw(event.target.value)}
            />
          </div>
          {extracted ? (
            <p className="entry-extracted">
              已提取 Key：<strong>{extracted}</strong>
            </p>
          ) : null}
          {statusText ? (
            <p
              className={`entry-status ${statusKind === "ok" ? "is-ok" : statusKind === "checking" ? "is-checking" : "is-error"}`}
              role="status"
            >
              {statusText}
            </p>
          ) : null}
          <button className="primary" type="submit" disabled={!canContinue}>
            连接 Bark
          </button>
        </form>
        <p className="entry-hint">支持完整推送 URL · 支持 Bark Key</p>
      </main>
    </div>
  );
}
