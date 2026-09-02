import type { ReactNode } from "react";

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "ok" | "quiet" | "warn";
  children: ReactNode;
}) {
  return <span className={`ds-badge is-${tone}`}>{children}</span>;
}

export function StatusDot({ online }: { online: boolean }) {
  return (
    <span className={`ds-status ${online ? "is-online" : "is-offline"}`}>
      <span className="ds-status-dot" aria-hidden="true" />
      {online ? "Online" : "Offline"}
    </span>
  );
}

export function Switch({
  checked,
  label,
  disabled,
  onChange,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={`ds-switch${checked ? " is-on" : ""}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}
