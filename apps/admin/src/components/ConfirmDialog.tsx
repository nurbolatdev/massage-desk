import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  text: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  busy?: boolean;
  error?: string;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  text,
  confirmLabel,
  cancelLabel,
  onConfirm,
  busy = false,
  error,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const keepOpen = (event: Event) => {
    if (busy) event.preventDefault();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelRef.current?.focus();
        }}
        onEscapeKeyDown={keepOpen}
        onPointerDownOutside={keepOpen}
        onInteractOutside={keepOpen}
      >
        <div className="flex flex-col gap-14 px-24 pt-20 pb-16">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{text}</DialogDescription>
          {error ? (
            <p
              role="alert"
              className="rounded-10 bg-danger-soft px-12 py-10 text-secondary text-danger-strong"
            >
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex justify-end gap-10 border-t border-divider px-24 pt-14 pb-20">
          <Button
            ref={cancelRef}
            variant="secondary"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
