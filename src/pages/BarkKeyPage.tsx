import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { checkDeviceKey, remoteStatusMessage } from "../bark/checkDeviceKey";
import { extractBarkKey } from "../bark/extractBarkKey";
import { localValidateBarkKey, localValidateMessage } from "../bark/localValidate";
import "../styles/base.css";
import "../styles/entry.css";

type RemoteStatus = {
  key: string;
  kind: "ok" | "error";
  text: string;
};

export function BarkKeyPage() {
  const navigate = useNavigate();
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

  return (
    <div className="entry-page">
      <main className="entry-main">
        <h1>发个通知</h1>
        <p className="entry-lead">从 Bark 复制测试推送链接并粘贴到下方，校验通过后进入订阅配置。</p>
        <form
          className="entry-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canContinue || !extracted) {
              return;
            }
            navigate("/subscribe", { state: { barkKey: extracted } });
          }}
        >
          <div>
            <label htmlFor="bark-test-link">Bark 测试链接</label>
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
            进入订阅配置
          </button>
        </form>
      </main>
    </div>
  );
}
