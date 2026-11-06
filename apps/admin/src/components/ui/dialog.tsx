import type { ComponentProps } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { icon } from "@/components/icon";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;

type ContentProps = ComponentProps<typeof DialogPrimitive.Content> & { showClose?: boolean };

export function DialogContent({ className, children, showClose = true, ...props }: ContentProps) {
  return (
    <DialogPrimitive.Portal>
      {/* The overlay fills the viewport (top and left at 100%, shifted back) and centres the dialog. */}
      <DialogPrimitive.Overlay className="fixed top-full left-full z-(--z-overlay) grid h-screen w-screen -translate-x-full -translate-y-full place-items-center overflow-y-auto bg-scrim p-16">
        <DialogPrimitive.Content
          className={cn(
            "relative flex w-dialog max-w-full flex-col rounded-18 bg-surface shadow-dialog",
            className,
          )}
          {...props}
        >
          {children}
          {showClose ? (
            <DialogPrimitive.Close
              aria-label="Закрыть"
              className="absolute top-20 right-24 flex size-target-s items-center justify-center rounded-8 text-muted"
            >
              <X size={icon.close} strokeWidth={icon.stroke} aria-hidden="true" />
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Overlay>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-title-s text-ink", className)} {...props} />;
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description className={cn("text-body text-ink", className)} {...props} />
  );
}
