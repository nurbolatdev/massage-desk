import { useId, useRef, useState } from "react";
import { CircleAlert, RefreshCw, Search, Users } from "lucide-react";

import { PageMain } from "@/components/PageMain";
import { PageSkeleton } from "@/components/PageSkeleton";
import { StateCard } from "@/components/StateCard";
import { icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadErrorText } from "@/lib/data/calendar";
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
  clientsView,
  notFoundTitle,
  uniqueClients,
} from "@/lib/data/clients";
import { useClients } from "@/lib/data/hooks";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useOnline } from "@/lib/useOnline";

import { ClientsTable } from "./ClientsTable";

/** Clients directory with debounced search, pagination and empty/offline/error states. */
export function ClientsPage() {
  const [text, setText] = useState("");
  const term = useDebouncedValue(text.trim(), SEARCH_DELAY_MS);
  const clients = useClients(term);
  const online = useOnline();
  const tableRef = useRef<HTMLTableElement>(null);
  const searchId = useId();

  const rows = clients.data ? uniqueClients(clients.data.pages) : [];
  const view = clientsView({
    hasData: clients.data !== undefined,
    error: clients.error,
    count: rows.length,
    term,
  });
  const searchOffline = !online && Boolean(term) && clients.data === undefined;

  const loadMore = async () => {
    const result = await clients.fetchNextPage();
    if (!result.isError && !result.hasNextPage) {
      tableRef.current?.focus();
    }
  };

  return (
    <PageMain>
      <div className="flex flex-wrap items-center justify-between gap-14">
        <h1 className="text-title text-ink">{CLIENTS_TITLE}</h1>
        <div className="relative min-w-0 grow basis-panel-basis md:max-w-form md:grow-0">
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

      {searchOffline && (
        <p role="status" className="text-body text-muted">
          {SEARCH_OFFLINE}
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
      {view === "notFound" && (
        <StateCard icon={Search} title={notFoundTitle(term)} text={NOT_FOUND_TEXT} />
      )}
      {view === "list" && (
        <div className="flex flex-col items-start gap-12">
          <ClientsTable clients={rows} tableRef={tableRef} />
          {clients.hasNextPage && (
            <Button
              type="button"
              variant="secondary"
              disabled={clients.isFetchingNextPage || !online}
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
      )}
    </PageMain>
  );
}
