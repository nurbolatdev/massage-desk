import type { RefObject } from "react";

import {
  CLIENTS_TITLE,
  COLUMN_CLIENT,
  COLUMN_SINCE,
  clientName,
  clientSince,
  hasName,
  type Client,
} from "@/lib/data/clients";

import { ClientAvatar } from "./ClientAvatar";

const TH = "border-b border-line px-16 py-14 text-left text-secondary text-muted";
const TD = "border-b border-divider px-16 py-12";

/** Alphabetical clients table with selectable client rows, showing avatar, name, phone and join date. */
export function ClientsTable({
  clients,
  selectedId,
  onSelect,
  tableRef,
}: {
  clients: readonly Client[];
  selectedId: string | null;
  onSelect: (id: string) => void;
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
              <th scope="col" className={TH}>
                {COLUMN_SINCE}
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
                  <td className={`${TD} text-body text-text-strong whitespace-nowrap`}>
                    {clientSince(client.createdAt)}
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
