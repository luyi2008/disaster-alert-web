import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "quiet";
  block?: boolean;
};

export function Button({
  variant = "primary",
  block = false,
  className = "",
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`ds-btn ds-btn-${variant}${block ? " is-block" : ""} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  reserveMessage = false,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string | null;
  hint?: string;
  reserveMessage?: boolean;
  children: ReactNode;
}) {
  const message = error || hint || "";
  const showMessage = Boolean(error || hint || reserveMessage);
  return (
    <div className={`ds-field${error ? " is-invalid" : ""}`}>
      <label className="ds-field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {showMessage ? (
        <span
          className={`ds-field-message${error ? " is-error" : hint ? " is-hint" : ""}`}
          role={error ? "alert" : undefined}
        >
          {message}
        </span>
      ) : null}
    </div>
  );
}
