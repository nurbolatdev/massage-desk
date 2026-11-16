import {
  INTERVAL_LABEL,
  SPENT_LABEL,
  STATS_LOAD_FAILED,
  STATS_OFFLINE,
  formatInterval,
  formatSpent,
  visitsLabel,
} from "@/lib/data/clientVisits";
import { blockView } from "@/lib/data/clients";
import { useClientStats } from "@/lib/data/hooks";

import { BlockError, BlockSkeleton } from "./ClientBlockState";

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex grow basis-0 flex-col-reverse rounded-10 bg-bg-page px-4 py-10">
      <dt className="text-label font-normal text-muted">{label}</dt>
      <dd className="text-title-s whitespace-nowrap text-ink">{value}</dd>
    </div>
  );
}

/** Visit count, total spent and visit interval of one client. */
export function ClientStats({ clientId }: { clientId: string }) {
  const query = useClientStats(clientId);
  const view = blockView({
    hasData: query.data !== undefined,
    error: query.error,
    paused: query.fetchStatus === "paused",
  });

  if (view === "loading") return <BlockSkeleton lines="tiles" />;
  if (view === "error") {
    return (
      <BlockError
        title={STATS_LOAD_FAILED}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (view === "offline") {
    return (
      <p role="status" className="text-body text-muted">
        {STATS_OFFLINE}
      </p>
    );
  }
  if (!query.data) return null;
  const { visits, totalSpent, visitIntervalDays } = query.data;
  return (
    <dl className="flex flex-wrap gap-8 text-center">
      <Tile label={visitsLabel(visits)} value={String(visits)} />
      <Tile label={SPENT_LABEL} value={formatSpent(totalSpent)} />
      <Tile label={INTERVAL_LABEL} value={formatInterval(visitIntervalDays)} />
    </dl>
  );
}
