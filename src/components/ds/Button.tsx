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
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string | null;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={`ds-field${error ? " is-invalid" : ""}`}>
      <label className="ds-field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <span className="ds-field-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="ds-field-hint">{hint}</span>
      ) : null}
    </div>
  );
}
