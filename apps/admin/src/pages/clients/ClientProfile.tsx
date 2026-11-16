import type { Ref } from "react";
import { RefreshCw } from "lucide-react";

import { icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { loadErrorText } from "@/lib/data/calendar";
import {
  NOTE_LOAD_FAILED,
  NOTE_OFFLINE,
  PICK_CLIENT,
  PROFILE_LABEL,
  clientName,
  clientSinceText,
  hasName,
  blockView,
  type Client,
} from "@/lib/data/clients";
import { useClient } from "@/lib/data/hooks";

import { ClientAvatar } from "./ClientAvatar";
import { ClientNote } from "./ClientNote";

function ProfileBody({
  client,
  nameRef,
}: {
  client: Client;
  nameRef?: Ref<HTMLHeadingElement>;
}) {
  const query = useClient(client.id);
  const shown = query.data ?? client;
  const view = blockView({
    hasData: query.data !== undefined,
    error: query.error,
    paused: query.fetchStatus === "paused",
  });

  return (
    <>
      <div className="flex items-center gap-12">
        <ClientAvatar name={shown.name} size="card" />
        <div className="flex min-w-0 flex-col gap-2">
          <h2 ref={nameRef} tabIndex={-1} className="text-title-s break-words text-ink">
            {clientName(shown)}
          </h2>
          {hasName(shown) && <p className="text-body text-muted">{shown.phone}</p>}
          <p className="text-secondary text-muted">{clientSinceText(shown.createdAt)}</p>
        </div>
      </div>

      {view === "loading" && (
        <div aria-busy="true" className="flex flex-col gap-6">
          <div aria-hidden="true" className="h-14 w-1/4 rounded-6 bg-segment-bg" />
          <div aria-hidden="true" className="h-64 rounded-10 bg-segment-bg" />
          <span className="sr-only">Загрузка…</span>
        </div>
      )}

      {view === "error" && (
        <div role="alert" className="flex flex-col items-start gap-8">
          <p className="text-body font-bold text-ink">{NOTE_LOAD_FAILED}</p>
          <p className="text-secondary font-normal text-muted">{loadErrorText(query.error)}</p>
          <Button type="button" variant="secondary" onClick={() => void query.refetch()}>
            <RefreshCw size={icon.button} strokeWidth={icon.stroke} aria-hidden="true" />
            Повторить
          </Button>
        </div>
      )}

      {view === "offline" && (
        <p role="status" className="text-body text-muted">
          {NOTE_OFFLINE}
        </p>
      )}

      {view === "ready" && query.data && <ClientNote client={query.data} />}
    </>
  );
}

/** Side panel displaying the selected client's header details and fresh editable note. */
export function ClientProfile({
  client,
  nameRef,
}: {
  client: Client | null;
  nameRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <aside
      aria-label={PROFILE_LABEL}
      className="flex min-w-0 basis-panel-basis grow flex-col gap-16 rounded-16 border border-line bg-surface p-20"
    >
      {client === null ? (
        <p className="text-body text-muted">{PICK_CLIENT}</p>
      ) : (
        <ProfileBody key={client.id} client={client} nameRef={nameRef} />
      )}
    </aside>
  );
}
