import { useEffect, useId, useRef, useState } from "react";
import { localDay } from "@massage-desk/shared";
import { CircleAlert, RefreshCw, Search, Users } from "lucide-react";

import { PageMain } from "@/components/PageMain";
import { PageSkeleton } from "@/components/PageSkeleton";
import { StateCard } from "@/components/StateCard";
import { icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadErrorText } from "@/lib/data/calendar";
import { FILTER_OFFLINE, SEGMENT_EMPTY, summaryText } from "@/lib/data/clientList";
import {
  CLIENTS_TITLE,
  EMPTY_TEXT,
  EMPTY_TITLE,
  LOAD_FAILED,
  MORE_FAILED,
  NOT_FOUND_TEXT,
  SEARCH_DELAY_MS,
  SEARCH_LABEL,
  SEARCH_OFFLINE,
  SEARCH_PLACEHOLDER,
  SHOW_MORE,
  type SegmentFilter,
  clientsView,
  nextOffset,
  notFoundTitle,
  uniqueById,
} from "@/lib/data/clients";
import { useClients, useClientsSummary, useTimeZone } from "@/lib/data/hooks";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useNow } from "@/lib/useNow";
import { useOnline } from "@/lib/useOnline";

import { ClientFilters } from "./ClientFilters";
import { ClientProfile } from "./ClientProfile";
import { ClientsTable } from "./ClientsTable";

/** Clients directory with debounced search, pagination and empty/offline/error states. */
export function ClientsPage() {
  const [text, setText] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const term = useDebouncedValue(text.trim(), SEARCH_DELAY_MS);
  const [segment, setSegment] = useState<SegmentFilter>("all");
  const clients = useClients(term, segment);
  const summary = useClientsSummary();
  const subtitle = summary.data ? summaryText(summary.data) : null;
  const online = useOnline();
  const timeZone = useTimeZone();
  const now = useNow();
  const today = timeZone ? localDay(now, timeZone) : undefined;
  const tableRef = useRef<HTMLElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const nameRef = useRef<HTMLHeadingElement>(null);
  const termRef = useRef(term);
  const segmentRef = useRef(segment);
  useEffect(() => {
    termRef.current = term;
    segmentRef.current = segment;
  }, [term, segment]);
  useEffect(() => {
    if (selectedId) nameRef.current?.focus();
  }, [selectedId]);
  const searchId = useId();

  const pages = clients.data?.pages;
  const rows = pages ? uniqueById(pages) : [];
  const hasMore =
    clients.hasNextPage ||
    Boolean(
      clients.isPlaceholderData &&
        pages &&
        nextOffset(pages.at(-1) ?? [], pages) !== undefined,
    );
  const selected = rows.find((c) => c.id === selectedId) ?? null;
  const view = clientsView({
    hasData: clients.data !== undefined,
    error: clients.error,
    count: rows.length,
    term,
    segment,
  });
  const filterOffline =
    !online &&
    (Boolean(term) || segment !== "all") &&
    (clients.data === undefined || clients.isPlaceholderData);

  const pickSegment = (next: SegmentFilter) => {
    if (next === segment) return;
    if (selected === null) setSelectedId(null);
    setSegment(next);
  };

  const loadMore = async () => {
    if (clients.isFetchingNextPage || clients.isPlaceholderData || !online) return;
    const requestedTerm = term;
    const requestedSegment = segment;
    const result = await clients.fetchNextPage();
    const active = document.activeElement;
    const focusFree =
      active === null ||
      active === document.body ||
      active === moreRef.current ||
      active === tableRef.current;
    if (
      !result.isError &&
      !result.hasNextPage &&
      termRef.current === requestedTerm &&
      segmentRef.current === requestedSegment &&
      focusFree
    ) {
      tableRef.current?.focus();
    }
  };

  return (
    <PageMain>
      <div className="flex flex-wrap items-center justify-between gap-14">
        <div className="flex flex-col gap-4">
          <h1 className="text-title text-ink">{CLIENTS_TITLE}</h1>
          {subtitle !== null && <p className="text-body font-normal text-muted">{subtitle}</p>}
        </div>
        <div className="relative min-w-0 grow basis-panel-basis md:grow-0">
          <Label htmlFor={searchId} className="sr-only">
            {SEARCH_LABEL}
          </Label>
          <Search
            size={icon.button}
            strokeWidth={icon.stroke}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-12 -translate-y-1/2 text-muted"
          />
          <Input
            id={searchId}
            type="search"
            placeholder={SEARCH_PLACEHOLDER}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="pl-40"
          />
        </div>
      </div>

      <ClientFilters value={segment} onChange={pickSegment} />

      {filterOffline && (
        <p role="status" className="text-body text-muted">
          {term ? SEARCH_OFFLINE : FILTER_OFFLINE}
        </p>
      )}

      {view === "loading" && <PageSkeleton />}
      {view === "error" && (
        <StateCard
          icon={CircleAlert}
          title={LOAD_FAILED}
          text={loadErrorText(clients.error)}
          action={
            <Button type="button" variant="secondary" onClick={() => void clients.refetch()}>
              <RefreshCw size={icon.button} strokeWidth={icon.stroke} aria-hidden="true" />
              Повторить
            </Button>
          }
        />
      )}
      {view === "empty" && <StateCard icon={Users} title={EMPTY_TITLE} text={EMPTY_TEXT} />}
      {view === "emptySegment" && segment !== "all" && (
        <StateCard
          icon={Users}
          title={SEGMENT_EMPTY[segment].title}
          text={SEGMENT_EMPTY[segment].text}
        />
      )}
      {view === "notFound" && (
        <StateCard icon={Search} title={notFoundTitle(term)} text={NOT_FOUND_TEXT} />
      )}
      {view === "list" && (
        <div className="flex flex-wrap items-start gap-16">
          <div className="flex min-w-0 shrink grow-999 basis-content flex-col items-start gap-12">
            <ClientsTable
              clients={rows}
              selectedId={selectedId}
              onSelect={setSelectedId}
              today={today}
              year={now.getFullYear()}
              tableRef={tableRef}
            />
            {hasMore && (
              <Button
                type="button"
                variant="secondary"
                ref={moreRef}
                aria-disabled={clients.isFetchingNextPage || clients.isPlaceholderData || !online}
                className="aria-disabled:bg-disabled-bg aria-disabled:text-neutral-fg aria-disabled:border-disabled-bg"
                onClick={() => void loadMore()}
              >
                {SHOW_MORE}
              </Button>
            )}
            {clients.isFetchNextPageError && (
              <p role="alert" className="text-secondary text-danger">
                {MORE_FAILED}
              </p>
            )}
          </div>
          <ClientProfile client={selected} nameRef={nameRef} />
        </div>
      )}
    </PageMain>
  );
}
