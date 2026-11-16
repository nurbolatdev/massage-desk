import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  NOTE_FIELD_LABEL,
  NOTE_MAX_LENGTH,
  NOTE_SAVED,
  NOTE_SAVE_LABEL,
  NOTE_SAVE_OFFLINE,
  noteSaveErrorText,
  type Client,
} from "@/lib/data/clients";
import { useSaveClientNote } from "@/lib/data/hooks";
import { useOnline } from "@/lib/useOnline";

/** Editable client note with draft preservation, offline guard, and server error feedback. */
export function ClientNote({ client }: { client: Client }) {
  const save = useSaveClientNote(client.id);
  const online = useOnline();
  const fieldId = useId();
  const hintId = useId();
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const [edited, setEdited] = useState<string | null>(null);
  const [propNotes, setPropNotes] = useState(client.notes);
  // The field shows the server response until the parent re-renders after setQueryData.
  const [savedOverride, setSavedOverride] = useState<string | null>(null);

  if (client.notes !== propNotes) {
    setPropNotes(client.notes);
    setSavedOverride(null);
  }

  const saved = savedOverride ?? client.notes ?? "";
  const draft = edited ?? saved;
  const dirty = edited !== null && edited !== saved;

  const submit = () => {
    if (save.isPending || !online) return;
    save.mutate(draft, {
      onSuccess: (updated) => {
        setEdited(null);
        setSavedOverride(updated.notes ?? "");
        fieldRef.current?.focus();
      },
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Label htmlFor={fieldId} className="text-secondary font-bold text-muted">
        {NOTE_FIELD_LABEL}
      </Label>
      <textarea
        id={fieldId}
        ref={fieldRef}
        rows={3}
        maxLength={NOTE_MAX_LENGTH}
        readOnly={save.isPending}
        value={draft}
        onChange={(e) => {
          if (save.isSuccess) save.reset();
          setEdited(e.target.value);
        }}
        className="w-full resize-y rounded-10 border border-line bg-note px-12 py-10 text-body text-ink"
      />
      {dirty && (
        <div className="flex flex-wrap items-center gap-12">
          <Button
            type="button"
            aria-disabled={save.isPending || !online}
            aria-describedby={online ? undefined : hintId}
            className="aria-disabled:bg-disabled-bg aria-disabled:text-neutral-fg aria-disabled:border-disabled-bg"
            onClick={submit}
          >
            {NOTE_SAVE_LABEL}
          </Button>
          {!online && (
            <p id={hintId} className="text-secondary text-muted">
              {NOTE_SAVE_OFFLINE}
            </p>
          )}
        </div>
      )}
      {save.isError && dirty && (
        <p role="alert" className="text-secondary text-danger">
          {noteSaveErrorText(save.error)}
        </p>
      )}
      <div role="status" aria-live="polite">
        {save.isSuccess && !dirty && <p className="text-body text-muted">{NOTE_SAVED}</p>}
      </div>
    </div>
  );
}
