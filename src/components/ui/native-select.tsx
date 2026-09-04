import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { fieldControlClassName } from "@/components/ui/input";

function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <div
      className="relative w-full min-w-0 has-[select:disabled]:opacity-50"
      data-slot="select-wrap"
    >
      <select
        data-slot="select"
        className={cn(fieldControlClassName, "cursor-pointer appearance-none pr-9 disabled:opacity-100", className)}
        {...props}
      />
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  );
}

export { NativeSelect };
