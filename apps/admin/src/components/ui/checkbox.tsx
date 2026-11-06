import type { ComponentProps } from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { icon } from "@/components/icon";
import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "flex size-check shrink-0 items-center justify-center rounded-4 border border-border-strong bg-surface aria-checked:border-primary aria-checked:bg-primary disabled:bg-disabled-bg",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex text-surface">
        <Check size={icon.button} strokeWidth={icon.stroke} aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
