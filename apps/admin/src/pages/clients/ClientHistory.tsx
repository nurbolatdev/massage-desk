import { useId } from "react";

import {
  HISTORY_EMPTY,
  HISTORY_LOAD_FAILED,
  HISTORY_OFFLINE,
  HISTORY_TITLE,
  historyDay,
  historyStatus,
  type HistoryTone,
} from "@/lib/data/clientVisits";
import { blockView, uniqueById } from "@/lib/data/clients";
import { useClientHistory } from "@/lib/data/hooks";
import { useNow } from "@/lib/useNow";

import { BlockError, BlockSkeleton } from "./ClientBlockState";

const TONE_CLASS: Record<HistoryTone, string> = {
  done: "text-primary-strong",
  planned: "text-text-strong",
  missed: "text-accent-strong",
  cancelled: "text-muted",
};

/** Latest appointments of one client, newest first. */
export function ClientHistory({ clientId }: { clientId: string }) {
  const headingId = useId();
  const now = useNow();
  const query = useClientHistory(clientId);
  const rows = query.data ? uniqueById(query.data.pages) : [];
  const view = blockView({
    hasData: query.data !== undefined,
    error: query.error,
    paused: query.fetchStatus === "paused",
  });

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-8">
      <h3 id={headingId} className="text-secondary font-bold text-muted">
        {HISTORY_TITLE}
      </h3>

      {view === "loading" && <BlockSkeleton lines="rows" />}

      {view === "error" && (
        <BlockError
          title={HISTORY_LOAD_FAILED}
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      )}

      {view === "offline" && (
        <p role="status" className="text-body text-muted">
          {HISTORY_OFFLINE}
        </p>
      )}

      {view === "ready" && rows.length === 0 && (
        <p className="text-body text-muted">{HISTORY_EMPTY}</p>
      )}

      {view === "ready" && rows.length > 0 && (
        <ul aria-labelledby={headingId}>
          {rows.map((item) => {
            const status = historyStatus(item, now);
            return (
              <li
                key={item.id}
                className="flex flex-wrap justify-between gap-x-8 border-b border-divider py-6 text-body text-ink"
              >
                <span className="min-w-0 break-words">
                  {historyDay(item.start, now.getFullYear())} · {item.serviceName}
                </span>
                <span className={`shrink-0 font-semibold ${TONE_CLASS[status.tone]}`}>
                  {status.text}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
