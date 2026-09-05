import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { fieldControlClassName } from "@/components/ui/input";

function InputGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      className={cn("flex items-stretch gap-2", className)}
      {...props}
    />
  );
}

function InputGroupAddon({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="input-group-addon"
      className={cn(
        fieldControlClassName,
        "flex w-[72px] shrink-0 items-center justify-center px-0 text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { InputGroup, InputGroupAddon };
