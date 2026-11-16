import { useId } from "react";
import { RefreshCw } from "lucide-react";

import { icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { loadErrorText } from "@/lib/data/calendar";

/** Loading placeholder for a client card block. */
export function BlockSkeleton({ lines }: { lines: "note" | "tiles" | "rows" }) {
  return (
    <div
      aria-busy="true"
      className={lines === "tiles" ? "flex gap-8" : "flex flex-col gap-6"}
    >
      {lines === "note" && (
        <>
          <div aria-hidden="true" className="h-14 w-1/4 rounded-6 bg-segment-bg" />
          <div aria-hidden="true" className="h-64 rounded-10 bg-segment-bg" />
        </>
      )}
      {lines === "tiles" &&
        [0, 1, 2].map((i) => (
          <div key={i} aria-hidden="true" className="h-56 grow rounded-10 bg-segment-bg" />
        ))}
      {lines === "rows" &&
        [0, 1, 2].map((i) => (
          <div key={i} aria-hidden="true" className="h-14 rounded-6 bg-segment-bg" />
        ))}
      <span className="sr-only">Загрузка…</span>
    </div>
  );
}

/** Load failure of a client card block with a retry button. */
export function BlockError({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: unknown;
  onRetry: () => void;
}) {
  const titleId = useId();
  return (
    <div role="alert" className="flex flex-col items-start gap-8">
      <p id={titleId} className="text-body font-bold text-ink">
        {title}
      </p>
      <p className="text-secondary font-normal text-muted">{loadErrorText(error)}</p>
      <Button type="button" variant="secondary" aria-describedby={titleId} onClick={onRetry}>
        <RefreshCw size={icon.button} strokeWidth={icon.stroke} aria-hidden="true" />
        Повторить
      </Button>
    </div>
  );
}
