import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { CaptchaCodeInput } from "./PhoneInput";

export type CaptchaDialogProps = {
  open: boolean;
  svg: string | null;
  challengeKey: string;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
  onConfirm: (code: string) => void;
};

function CaptchaTape({ svg, loading }: { svg: string | null; loading: boolean }) {
  const trimmed = svg?.trim() ?? "";
  const isDataUri = trimmed.startsWith("data:");
  return (
    <div className={loading ? "captcha-tape is-loading" : "captcha-tape"} role="img" aria-label="图形验证码">
      {trimmed && isDataUri ? <img alt="" src={trimmed} /> : null}
      {trimmed && !isDataUri ? <div dangerouslySetInnerHTML={{ __html: trimmed }} /> : null}
    </div>
  );
}

export function CaptchaDialog({
  open,
  svg,
  challengeKey,
  loading,
  submitting,
  error,
  onOpenChange,
  onRefresh,
  onConfirm,
}: CaptchaDialogProps) {
  const leadId = useId();
  const [code, setCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [seenKey, setSeenKey] = useState(challengeKey);

  if (seenKey !== challengeKey) {
    setSeenKey(challengeKey);
    setCode("");
    setLocalError(null);
  }

  const message = localError || (code ? null : error);
  const invalid = Boolean(message);

  function submit(next = code) {
    if (submitting) {
      return;
    }
    if (next.length < 6) {
      setLocalError("请输入图形验证码");
      return;
    }
    onConfirm(next);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="captcha-sheet sm:max-w-[400px] gap-3 max-sm:top-auto max-sm:right-0 max-sm:bottom-0 max-sm:left-0 max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-2xl"
        aria-describedby={leadId}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById("captcha-code")?.focus();
        }}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <DialogTitle>图形验证码</DialogTitle>
        <div className="sheet-lead-row">
          <DialogDescription id={leadId} className="sheet-lead">
            看图输入 6 位数字，正确后发送短信
          </DialogDescription>
          <Button
            type="button"
            variant="link"
            className="otp-send"
            disabled={loading || submitting}
            onClick={() => {
              setCode("");
              setLocalError(null);
              onRefresh();
            }}
          >
            换一张
          </Button>
        </div>
        <CaptchaTape svg={svg} loading={loading} />
        <CaptchaCodeInput
          id="captcha-code"
          value={code}
          invalid={invalid}
          onChange={(next) => {
            setCode(next);
            setLocalError(null);
            if (next.length === 6) {
              submit(next);
            }
          }}
        />
        {message ? (
          <span className="captcha-hint" role="alert">
            {message}
          </span>
        ) : (
          <span className="captcha-hint" />
        )}
        <Button
          type="button"
          className="captcha-confirm w-full"
          disabled={submitting}
          onClick={() => submit()}
        >
          {submitting ? "发送中…" : "确认并发送"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="sheet-cancel"
          disabled={submitting}
          onClick={() => onOpenChange(false)}
        >
          取消
        </Button>
      </DialogContent>
    </Dialog>
  );
}
