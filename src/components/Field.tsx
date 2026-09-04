import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
    <div className="grid gap-2" data-slot="field">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {showMessage ? (
        <span
          data-slot="field-message"
          className={cn(
            "min-h-[1.45em] text-[13px] leading-[1.45]",
            error ? "text-destructive" : hint ? "text-muted-foreground" : "",
          )}
          role={error ? "alert" : undefined}
        >
          {message}
        </span>
      ) : null}
    </div>
  );
}

export function StatusMessage({
  kind,
  children,
}: {
  kind: "success" | "error" | "info";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mb-4 rounded-md px-3 py-2.5 text-[13px] leading-[1.45]",
        kind === "error" && "bg-destructive/10 text-destructive",
        kind === "success" && "bg-[var(--ok-bg)] text-[var(--ok)]",
        kind === "info" && "bg-[var(--info-bg)] text-[var(--info)]",
      )}
      role={kind === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
