import { useId } from "react";

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

import { BlockError, BlockSkeleton } from "../clients/ClientBlockState";

const TH = "border-b border-line px-16 py-14 text-left text-secondary text-muted";
const TD = "border-b border-divider px-16 py-12 text-body";

function ServicesTable({ services, titleId }: { services: readonly Service[]; titleId: string }) {
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Read-only list of all services, active and hidden, with its own loading, error and offline states. */
export function ServicesSection() {
  const titleId = useId();
  const { data, error, fetchStatus, refetch } = useServices();
  const view = blockView({ hasData: data !== undefined, error, paused: fetchStatus === "paused" });

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-14 rounded-16 border border-line bg-surface p-20"
    >
      <h2 id={titleId} className="text-subtitle text-ink">
        {SERVICES_TITLE}
      </h2>
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
        <ServicesTable services={data} titleId={titleId} />
      )}
    </section>
  );
}
