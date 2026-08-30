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
      <main className="entry-main">
        <div className="entry-hero">
          <div className="entry-mark" aria-hidden="true">
            <svg width="200" height="176" viewBox="0 0 200 176" fill="none">
              <circle cx="126" cy="72" r="68" stroke="currentColor" strokeWidth="1.25" opacity="0.28" />
              <circle cx="126" cy="72" r="46" stroke="currentColor" strokeWidth="1.25" opacity="0.48" />
              <rect x="46" y="28" width="76" height="132" rx="14" stroke="currentColor" strokeWidth="1.75" />
              <rect x="56" y="44" width="56" height="92" rx="6" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="84" cy="148" r="3.25" fill="currentColor" />
              <rect x="92" y="52" width="58" height="40" rx="12" fill="var(--bg)" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="108" cy="72" r="4.5" fill="currentColor" />
              <path d="M118 72h22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <p className="entry-caption">Bark</p>
        </div>
        <h1>连接你的 Bark</h1>
        <p className="entry-lead">
          从 Bark App 复制测试推送链接，
          <br />
          粘贴到这里完成设备连接。
        </p>
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
              placeholder="粘贴测试链接或 22 位 Key"
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
