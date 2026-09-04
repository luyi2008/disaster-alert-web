import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      style={{
        "--normal-bg": "var(--panel)",
        "--normal-text": "var(--text)",
        "--normal-border": "var(--line)",
      } as CSSProperties}
      {...props}
    />
  );
}

export { Toaster };
