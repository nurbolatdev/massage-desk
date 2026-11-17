import { useId, useRef, useState, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, type AppointmentConflict } from "@/lib/api/errors";
import { blockView } from "@/lib/data/clients";
import {
  ADDRESS_LABEL,
  ADDRESS_MAX,
  BUSINESS_TITLE,
  HOURS_HINT,
  SAVED_SETTINGS,
  SAVE_SETTINGS_LABEL,
  SETTINGS_LOAD_FAILED,
  SETTINGS_OFFLINE,
  ZONE_CANCEL_LABEL,
  ZONE_CONFIRM_LABEL,
  ZONE_CONFIRM_TITLE,
  ZONE_CONFLICT_LIST_LABEL,
  ZONE_HINT,
  ZONE_LEGEND,
  businessDraft,
  isDirty,
  settingsBody,
  settingsSaveErrorKind,
  settingsSaveErrorText,
  zoneChanged,
  zoneConfirmText,
  zoneConflictText,
  zoneName,
  zoneOptions,
  type BusinessDraft,
  type Settings,
} from "@/lib/data/businessSettings";
import { useSaveSettings, useSettings } from "@/lib/data/hooks";
import { SAVE_OFFLINE_HINT } from "@/lib/data/workingHours";
import { useOnline } from "@/lib/useOnline";

import { BlockError, BlockSkeleton } from "../clients/ClientBlockState";
import { WorkingHoursConflictDialog } from "../schedule/WorkingHoursConflictDialog";

function BusinessForm({ saved, titleRef }: { saved: Settings; titleRef: RefObject<HTMLHeadingElement | null> }) {
  const baseId = useId();
  const addressId = `${baseId}-address`;
  const zoneHintId = `${baseId}-zone-hint`;
  const offlineId = `${baseId}-offline`;
  const saveRef = useRef<HTMLButtonElement>(null);

  const [base, setBase] = useState<Settings>(saved);
  const [draft, setDraft] = useState<BusinessDraft>(() => businessDraft(saved));
  const [ask, setAsk] = useState<AppointmentConflict[] | null>(null);
  const [done, setDone] = useState(false);

  if (saved !== base) {
    setBase(saved);
    if (!isDirty(base, draft)) setDraft(businessDraft(saved));
  }

  const online = useOnline();
  const save = useSaveSettings();
  const options = zoneOptions(saved.timeZone);
  const chosen = options.find((o) => o.id === draft.timeZone);

  const edit = (patch: Partial<BusinessDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setDone(false);
    if (save.isError) save.reset();
  };

  const submit = (force: boolean) => {
    save.mutate(settingsBody(saved, draft, force), {
      onSuccess: (settings) => {
        setBase(settings);
        setDraft(businessDraft(settings));
        setAsk(null);
        setDone(true);
        titleRef.current?.focus();
      },
      onError: (error) => {
        if (!force && settingsSaveErrorKind(error) === "conflict" && error instanceof ApiError) {
          setAsk(error.conflicts ?? []);
        }
      },
    });
  };

  const onSave = () => {
    if (!online || !isDirty(saved, draft) || save.isPending) return;
    if (zoneChanged(saved, draft)) setAsk([]);
    else submit(false);
  };

  const kind = save.error ? settingsSaveErrorKind(save.error) : null;
  const errorText = kind && kind !== "conflict" ? settingsSaveErrorText(kind, save.error) : undefined;
  const confirmName = chosen ? zoneName(chosen) : draft.timeZone;

  return (
    <>
      <form
        noValidate
        className="flex flex-col gap-14"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <div className="flex flex-col gap-6">
          <Label htmlFor={addressId}>{ADDRESS_LABEL}</Label>
          <Input
            id={addressId}
            maxLength={ADDRESS_MAX}
            readOnly={save.isPending}
            value={draft.address}
            onChange={(event) => edit({ address: event.target.value })}
          />
        </div>
        <fieldset aria-describedby={zoneHintId} className="flex flex-col gap-6">
          <legend className="text-secondary font-bold text-text-strong">{ZONE_LEGEND}</legend>
          <p id={zoneHintId} className="text-secondary text-muted">{ZONE_HINT}</p>
          <div className="divide-y divide-divider overflow-hidden rounded-12 border border-line">
            {options.map((option) => (
              <label key={option.id} className="flex min-h-target items-center gap-12 px-16 py-10">
                <input
                  type="radio"
                  name={`${baseId}-zone`}
                  value={option.id}
                  checked={draft.timeZone === option.id}
                  disabled={save.isPending}
                  onChange={() => edit({ timeZone: option.id })}
                  className="size-check shrink-0 accent-primary"
                />
                <span className="min-w-0 flex-1 text-body font-bold text-ink">{option.label}</span>
                {option.offset && <span className="whitespace-nowrap text-body text-muted">{option.offset}</span>}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="text-body text-muted">{HOURS_HINT}</p>
        <div className="flex flex-col gap-8">
          <div className="flex flex-wrap items-center gap-12">
            <Button
              ref={saveRef}
              type="submit"
              disabled={!isDirty(saved, draft) || save.isPending}
              aria-disabled={online ? undefined : true}
              aria-describedby={online ? undefined : offlineId}
              className="aria-disabled:border-disabled-bg aria-disabled:bg-disabled-bg aria-disabled:text-neutral-fg"
            >
              {SAVE_SETTINGS_LABEL}
            </Button>
            {!online && <p id={offlineId} className="text-secondary text-muted">{SAVE_OFFLINE_HINT}</p>}
          </div>
          {!ask && errorText && <p role="alert" className="text-secondary text-danger">{errorText}</p>}
          <div role="status" aria-live="polite">{done && <p className="text-body text-muted">{SAVED_SETTINGS}</p>}</div>
        </div>
      </form>
      {ask && (
        <WorkingHoursConflictDialog
          conflicts={ask}
          timeZone={draft.timeZone}
          title={ZONE_CONFIRM_TITLE}
          text={ask.length ? zoneConflictText(ask.length) : zoneConfirmText(confirmName)}
          confirmLabel={ZONE_CONFIRM_LABEL}
          cancelLabel={ZONE_CANCEL_LABEL}
          listLabel={ZONE_CONFLICT_LIST_LABEL}
          busy={save.isPending}
          error={errorText}
          onConfirm={() => submit(ask.length > 0)}
          onClose={() => {
            setAsk(null);
            save.reset();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (saveRef.current && !saveRef.current.disabled) saveRef.current.focus();
            else titleRef.current?.focus();
          }}
        />
      )}
    </>
  );
}

/** Address and time zone of the master with its own loading, error and offline states. */
export function BusinessSettingsSection() {
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { data, error, fetchStatus, refetch } = useSettings();
  const view = blockView({ hasData: data !== undefined, error, paused: fetchStatus === "paused" });

  return (
    <section
      aria-labelledby={titleId}
      className="flex max-w-content flex-col gap-14 rounded-16 border border-line bg-surface p-20"
    >
      <h2 id={titleId} ref={titleRef} tabIndex={-1} className="text-subtitle text-ink">
        {BUSINESS_TITLE}
      </h2>
      {view === "loading" && <BlockSkeleton lines="rows" />}
      {view === "error" && (
        <BlockError title={SETTINGS_LOAD_FAILED} error={error} onRetry={() => void refetch()} />
      )}
      {view === "offline" && (
        <p role="status" className="text-body text-muted">
          {SETTINGS_OFFLINE}
        </p>
      )}
      {view === "ready" && data !== undefined && <BusinessForm saved={data} titleRef={titleRef} />}
    </section>
  );
}
