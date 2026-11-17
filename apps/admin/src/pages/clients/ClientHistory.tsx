import { useId, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  HISTORY_EMPTY,
  HISTORY_LOAD_FAILED,
  HISTORY_MORE_FAILED,
  HISTORY_OFFLINE,
  HISTORY_TITLE,
  historyDay,
  historyStatus,
  type HistoryTone,
} from "@/lib/data/clientVisits";
import { SHOW_MORE, blockView, uniqueById } from "@/lib/data/clients";
import { useClientHistory } from "@/lib/data/hooks";
import { useNow } from "@/lib/useNow";
import { useOnline } from "@/lib/useOnline";

import { BlockError, BlockSkeleton } from "./ClientBlockState";

const TONE_CLASS: Record<HistoryTone, string> = {
  done: "text-primary-strong",
  planned: "text-text-strong",
  missed: "text-accent-strong",
  cancelled: "text-muted",
};

/** Appointments of one client, newest first, 10 at a time with a Show more button. */
export function ClientHistory({ clientId }: { clientId: string }) {
  const headingId = useId();
  const now = useNow();
  const query = useClientHistory(clientId);
  const online = useOnline();
  const listRef = useRef<HTMLUListElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const rows = query.data ? uniqueById(query.data.pages) : [];
  const view = blockView({
    hasData: query.data !== undefined,
    error: query.error,
    paused: query.fetchStatus === "paused",
  });

  const loadMore = async () => {
    if (query.isFetchingNextPage || !online) return;
    const result = await query.fetchNextPage();
    const active = document.activeElement;
    const focusFree =
      active === null ||
      active === document.body ||
      active === moreRef.current ||
      active === listRef.current;
    if (!result.isError && !result.hasNextPage && focusFree) listRef.current?.focus();
  };

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
        <ul ref={listRef} tabIndex={-1} aria-labelledby={headingId}>
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

      {view === "ready" && query.hasNextPage && (
        <Button
          type="button"
          variant="secondary"
          size="small"
          ref={moreRef}
          aria-disabled={query.isFetchingNextPage || !online}
          className="self-start aria-disabled:bg-disabled-bg aria-disabled:text-neutral-fg aria-disabled:border-disabled-bg"
          onClick={() => void loadMore()}
        >
          {SHOW_MORE}
        </Button>
      )}
      {view === "ready" && query.isFetchNextPageError && (
        <p role="alert" className="text-secondary text-danger">
          {HISTORY_MORE_FAILED}
        </p>
      )}
    </section>
  );
}
