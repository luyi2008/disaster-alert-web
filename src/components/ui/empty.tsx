import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn("flex max-w-md flex-col items-start gap-2 py-8", className)}
      {...props}
    />
  );
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 data-slot="empty-title" className={cn("m-0 text-lg font-semibold", className)} {...props} />;
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="empty-description"
      className={cn("m-0 text-sm leading-6 text-muted-foreground", className)}
      {...props}
    />
  );
}

function EmptyContent({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={cn("mt-1", className)}>{children}</div>;
}

export { Empty, EmptyTitle, EmptyDescription, EmptyContent };
