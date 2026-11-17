import type { RefObject } from "react";

import {
  CLIENTS_TITLE,
  COLUMN_CLIENT,
  clientName,
  hasName,
  type ClientListItem,
} from "@/lib/data/clients";
import {
  COLUMN_LAST,
  COLUMN_NEXT,
  COLUMN_NO_SHOWS,
  COLUMN_VISITS,
  lastVisitText,
  nextVisitText,
  noShowsClass,
} from "@/lib/data/clientList";

import { ClientAvatar } from "./ClientAvatar";

const TH = "border-b border-line px-16 py-14 text-left text-secondary text-muted";
const TD = "border-b border-divider px-16 py-12";
const TH_MID = "border-b border-line px-10 py-14 text-left text-secondary whitespace-nowrap text-muted";
const TH_LAST = "border-b border-line pl-10 pr-16 py-14 text-left text-secondary whitespace-nowrap text-muted";
const TD_MID = "border-b border-divider px-10 py-12 text-body whitespace-nowrap";
const TD_LAST = "border-b border-divider pl-10 pr-16 py-12 text-body";

/**
 * Alphabetical clients table with selectable rows: avatar, name, phone, visits,
 * last visit, next appointment and no-shows. `today` is the master's current day
 * (when known), `year` the current year for the last-visit date.
 */
export function ClientsTable({
  clients,
  selectedId,
  onSelect,
  today,
  year,
  tableRef,
}: {
  clients: readonly ClientListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  today: string | undefined;
  year: number;
  tableRef?: RefObject<HTMLElement | null>;
}) {
  return (
    <section
      ref={tableRef}
      tabIndex={-1}
      aria-label={CLIENTS_TITLE}
      className="w-full min-w-0 overflow-hidden rounded-16 border border-line bg-surface"
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <caption className="sr-only">{CLIENTS_TITLE}</caption>
          <thead>
            <tr>
              <th scope="col" className={TH}>
                {COLUMN_CLIENT}
              </th>
              <th scope="col" className={TH_MID}>
                {COLUMN_VISITS}
              </th>
              <th scope="col" className={TH_MID}>
                {COLUMN_LAST}
              </th>
              <th scope="col" className={TH_MID}>
                {COLUMN_NEXT}
              </th>
              <th scope="col" className={TH_LAST}>
                {COLUMN_NO_SHOWS}
              </th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => {
              const selected = client.id === selectedId;
              return (
                <tr key={client.id} className={selected ? "bg-primary-faint" : undefined}>
                  <td className={TD}>
                    <button
                      type="button"
                      aria-current={selected ? "true" : undefined}
                      onClick={() => onSelect(client.id)}
                      className="flex min-h-target w-full items-center gap-10 rounded-10 text-left"
                    >
                      <ClientAvatar name={client.name} />
                      <span className="flex min-w-0 flex-col">
                        <span className="text-body font-bold text-ink">{clientName(client)}</span>
                        {hasName(client) && (
                          <span className="text-secondary font-medium text-muted">
                            {client.phone}
                          </span>
                        )}
                      </span>
                    </button>
                  </td>
                  <td className={`${TD_MID} font-bold text-ink`}>{client.stats.visits}</td>
                  <td className={`${TD_MID} text-text-strong`}>
                    {lastVisitText(client.stats.lastVisitAt, year)}
                  </td>
                  <td className={`${TD_MID} text-text-strong`}>
                    {nextVisitText(client.stats.nextAppointmentAt, today)}
                  </td>
                  <td className={TD_LAST}>
                    <span className={noShowsClass(client.stats.noShows)}>
                      {client.stats.noShows}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
