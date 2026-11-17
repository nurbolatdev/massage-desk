import { Plus } from "lucide-react";
import { useId, useState } from "react";

import { icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { blockView } from "@/lib/data/clients";
import { useServices } from "@/lib/data/hooks";
import {
  COLUMN_DURATION,
  COLUMN_OFFERED,
  COLUMN_PRICE,
  COLUMN_SERVICE,
  SERVICES_EMPTY,
  SERVICES_LOAD_FAILED,
  SERVICES_OFFLINE,
  SERVICES_TITLE,
  formatDuration,
  formatPrice,
  offeredText,
  type Service,
} from "@/lib/data/services";
import { ADD_SERVICE_LABEL, EDIT_LABEL, editLabel, savedText } from "@/lib/data/serviceForm";

import { BlockError, BlockSkeleton } from "../clients/ClientBlockState";
import { ServiceDialog } from "./ServiceDialog";

const TH = "border-b border-line px-16 py-14 text-left text-secondary text-muted";
const TD = "border-b border-divider px-16 py-12 text-body";

type EditTarget = { service: Service | null; trigger: HTMLElement | null };

function ServicesTable({
  services,
  titleId,
  onEdit,
}: {
  services: readonly Service[];
  titleId: string;
  onEdit: (service: Service, trigger: HTMLElement) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-12 border border-line">
      <table aria-labelledby={titleId} className="w-full border-collapse">
        <thead>
          <tr>
            <th scope="col" className={TH}>
              {COLUMN_SERVICE}
            </th>
            <th scope="col" className={TH}>
              {COLUMN_DURATION}
            </th>
            <th scope="col" className={TH}>
              {COLUMN_PRICE}
            </th>
            <th scope="col" className={TH}>
              {COLUMN_OFFERED}
            </th>
            <td className={TH} />
          </tr>
        </thead>
        <tbody>
          {services.map((service) => (
            <tr key={service.id}>
              <th
                scope="row"
                className={`${TD} break-words text-left font-bold ${service.active ? "text-ink" : "text-neutral-fg"}`}
              >
                {service.name}
              </th>
              <td className={`${TD} whitespace-nowrap`}>{formatDuration(service.durationMin)}</td>
              <td className={`${TD} whitespace-nowrap`}>{formatPrice(service.price)}</td>
              <td className={TD}>
                <span className={service.active ? "font-semibold text-primary-strong" : "text-muted"}>
                  {offeredText(service.active)}
                </span>
              </td>
              <td className={`${TD} text-right`}>
                <button
                  type="button"
                  aria-label={editLabel(service.name)}
                  onClick={(event) => onEdit(service, event.currentTarget)}
                  className="h-target-s rounded-8 px-12 text-body font-bold text-primary-strong active:bg-segment-bg"
                >
                  {EDIT_LABEL}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** List of all services, active and hidden, with add and edit dialog and its own loading, error and offline states. */
export function ServicesSection() {
  const titleId = useId();
  const { data, error, fetchStatus, refetch } = useServices();
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const view = blockView({ hasData: data !== undefined, error, paused: fetchStatus === "paused" });

  const open = (service: Service | null, trigger: HTMLElement) => {
    setSaved(null);
    setEditing({ service, trigger });
  };

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-14 rounded-16 border border-line bg-surface p-20"
    >
      <div className="flex flex-wrap items-center justify-between gap-10">
        <h2 id={titleId} className="text-subtitle text-ink">
          {SERVICES_TITLE}
        </h2>
        {view === "ready" && (
          <Button onClick={(event) => open(null, event.currentTarget)}>
            <Plus size={icon.button} strokeWidth={icon.stroke} aria-hidden="true" />
            {ADD_SERVICE_LABEL}
          </Button>
        )}
      </div>
      {view === "loading" && <BlockSkeleton lines="rows" />}
      {view === "error" && (
        <BlockError title={SERVICES_LOAD_FAILED} error={error} onRetry={() => void refetch()} />
      )}
      {view === "offline" && (
        <p role="status" className="text-body text-muted">
          {SERVICES_OFFLINE}
        </p>
      )}
      {view === "ready" && data !== undefined && data.length === 0 && (
        <p className="text-body text-muted">{SERVICES_EMPTY}</p>
      )}
      {view === "ready" && data !== undefined && data.length > 0 && (
        <ServicesTable services={data} titleId={titleId} onEdit={open} />
      )}
      {view === "ready" && (
        <div role="status" aria-live="polite">
          {saved && <p className="text-body text-muted">{saved}</p>}
        </div>
      )}
      {editing && (
        <ServiceDialog
          service={editing.service}
          trigger={editing.trigger}
          onClose={() => setEditing(null)}
          onSaved={(done, outcome) => {
            setSaved(savedText(outcome, done.name));
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}
