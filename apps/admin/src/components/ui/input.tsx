import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "h-target w-full rounded-10 border border-border-strong bg-surface px-12 text-body text-ink disabled:bg-disabled-bg disabled:text-neutral-fg aria-invalid:border-warning-icon",
        className,
      )}
      {...props}
    />
  );
}
