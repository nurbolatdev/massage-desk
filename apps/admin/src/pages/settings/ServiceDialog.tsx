import { useId, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveService } from "@/lib/data/hooks";
import type { Service } from "@/lib/data/services";
import * as f from "@/lib/data/serviceForm";
import { SAVE_OFFLINE_HINT } from "@/lib/data/workingHours";
import { useOnline } from "@/lib/useOnline";

const OFFLINE_BUTTON = "aria-disabled:border-disabled-bg aria-disabled:bg-disabled-bg aria-disabled:text-neutral-fg";

type Props = {
  service: Service | null;
  trigger: HTMLElement | null;
  onClose: () => void;
  onSaved: (saved: Service, outcome: f.SaveOutcome) => void;
};

export function ServiceDialog({ service, trigger, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState(() => f.draftFrom(service));
  const [tried, setTried] = useState(false);
  const save = useSaveService();
  const online = useOnline();
  const id = useId();
  const refs = {
    name: useRef<HTMLInputElement>(null),
    duration: useRef<HTMLInputElement>(null),
    price: useRef<HTMLInputElement>(null),
  };
  const problems = tried ? f.checkDraft(draft).problems : {};
  const busy = save.isPending;
  const hidden = service !== null && !service.active;
  const hintId = `${id}-hint`;
  const offlineProps = (disabled: boolean) => ({
    "aria-disabled": !online || undefined,
    "aria-describedby": online ? undefined : hintId,
    disabled,
    className: OFFLINE_BUTTON,
  });

  const submit = (active?: boolean) => {
    if (busy || !online) return;
    setTried(true);
    const { values, problems: found } = f.checkDraft(draft);
    if (!values) {
      const first = f.FIELD_ORDER.find((field) => found[field]);
      if (first) refs[first].current?.focus();
      return;
    }
    let request: f.ServiceSave;
    if (service) {
      const body = f.updateBody(service, values, active);
      if (f.isEmptyBody(body)) {
        onClose();
        return;
      }
      request = { id: service.id, body };
    } else {
      request = { id: null, body: f.createBody(values) };
    }
    const outcome = active === undefined ? "saved" : active ? "shown" : "hidden";
    save.mutate(request, { onSuccess: (saved) => onSaved(saved, outcome) });
  };

  const keepOpen = (event: Event) => {
    if (busy) event.preventDefault();
  };
  const field = (key: f.ServiceField, label: string, mode: "text" | "numeric" | "decimal", wide: boolean) => {
    const errorId = `${id}-${key}-error`;
    return (
      <div className={wide ? "flex flex-col gap-6" : "flex min-w-0 flex-col gap-6"}>
        <Label htmlFor={`${id}-${key}`}>{label}</Label>
        <Input
          id={`${id}-${key}`}
          ref={refs[key]}
          value={draft[key]}
          inputMode={mode}
          readOnly={busy}
          aria-invalid={problems[key] ? true : undefined}
          aria-describedby={problems[key] ? errorId : undefined}
          onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
        />
        {problems[key] ? (
          <p id={errorId} className="text-secondary text-danger">
            {problems[key]}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        {...(hidden ? {} : { "aria-describedby": undefined })}
        onCloseAutoFocus={(event) => {
          if (!trigger?.isConnected) return;
          event.preventDefault();
          trigger.focus();
        }}
        onEscapeKeyDown={keepOpen}
        onPointerDownOutside={keepOpen}
        onInteractOutside={keepOpen}
      >
        <div className="flex flex-col gap-14 px-24 pt-20 pb-16">
          <DialogTitle className="pr-40">{service ? f.SERVICE_TITLE : f.NEW_SERVICE_TITLE}</DialogTitle>
          {hidden ? (
            <DialogDescription className="text-body text-muted">{f.HIDDEN_HINT}</DialogDescription>
          ) : null}
          <form
            id={`${id}-form`}
            noValidate
            className="flex flex-col gap-14"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              submit();
            }}
          >
            {field("name", f.NAME_LABEL, "text", true)}
            <div className="grid grid-cols-2 gap-10">
              {field("duration", f.DURATION_LABEL, "numeric", false)}
              {field("price", f.PRICE_LABEL, "decimal", false)}
            </div>
          </form>
          {save.isError ? (
            <p
              role="alert"
              className="rounded-10 bg-danger-soft px-12 py-10 text-secondary text-danger-strong"
            >
              {f.serviceSaveErrorText(f.serviceSaveErrorKind(save.error), save.error)}
            </p>
          ) : null}
          {online ? null : (
            <p id={hintId} className="text-secondary text-muted">
              {SAVE_OFFLINE_HINT}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-10 border-t border-divider px-24 pt-14 pb-20">
          {service ? (
            <Button
              type="button"
              variant={service.active ? "destructive" : "secondary"}
              {...offlineProps(busy)}
              onClick={() => submit(!service.active)}
            >
              {service.active ? f.HIDE_SERVICE_LABEL : f.SHOW_SERVICE_LABEL}
            </Button>
          ) : null}
          <div className="ml-auto flex gap-10">
            <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
              {f.CANCEL_LABEL}
            </Button>
            <Button type="submit" form={`${id}-form`} {...offlineProps(busy)}>
              {f.SAVE_SERVICE_LABEL}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
