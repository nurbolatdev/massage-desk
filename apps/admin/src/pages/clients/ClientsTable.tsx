import type { RefObject } from "react";
import { User } from "lucide-react";

import { icon } from "@/components/icon";
import {
  CLIENTS_TITLE,
  COLUMN_CLIENT,
  COLUMN_SINCE,
  clientInitials,
  clientName,
  clientSince,
  hasName,
  type Client,
} from "@/lib/data/clients";

const TH =
  "border-b border-line px-16 py-14 text-left text-secondary text-muted";
const TD = "border-b border-divider px-16 py-12";

function ClientAvatar({ name }: { name: string | null }) {
  const initials = clientInitials(name);
  return (
    <span
      aria-hidden="true"
      className="flex size-skeleton-avatar shrink-0 items-center justify-center rounded-full bg-primary-soft text-secondary font-extrabold text-primary-strong"
    >
      {initials || <User size={icon.button} strokeWidth={icon.stroke} />}
    </span>
  );
}

/** Alphabetical clients table showing avatar, name, phone and the date the client joined. */
export function ClientsTable({
  clients,
  tableRef,
}: {
  clients: readonly Client[];
  tableRef?: RefObject<HTMLElement | null>;
}) {
  return (
    <section
      ref={tableRef}
      tabIndex={-1}
      aria-label={CLIENTS_TITLE}
      className="w-full min-w-0 rounded-16 border border-line bg-surface"
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
            {clients.map((client) => (
              <tr key={client.id}>
                <td className={TD}>
                  <div className="flex items-center gap-10">
                    <ClientAvatar name={client.name} />
                    <div className="flex min-w-0 flex-col">
                      <span className="text-body font-bold text-ink">
                        {clientName(client)}
                      </span>
                      {hasName(client) && (
                        <span className="text-secondary font-medium text-muted">
                          {client.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td
                  className={`${TD} text-body text-text-strong whitespace-nowrap`}
                >
                  {clientSince(client.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
