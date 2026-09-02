type CaptchaSlotProps = {
  open: boolean;
  verified: boolean;
  loading: boolean;
  error?: string | null;
  onVerify: () => void;
};

export function CaptchaSlot({ open, verified, loading, error, onVerify }: CaptchaSlotProps) {
  if (!open && !verified) {
    return null;
  }
  return (
    <div className="ds-captcha" data-state={loading ? "loading" : verified ? "ok" : "idle"}>
      <button
        type="button"
        className="ds-captcha-box"
        onClick={onVerify}
        disabled={verified || loading}
        aria-pressed={verified}
      >
        <span className="ds-captcha-mark" aria-hidden="true">
          {loading ? "" : verified ? "✓" : ""}
        </span>
        <span>{loading ? "Verifying…" : verified ? "Verified" : "Confirm you are human"}</span>
      </button>
      <p className="ds-captcha-note">Human verification · placeholder for Turnstile</p>
      {error ? (
        <p className="ds-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
