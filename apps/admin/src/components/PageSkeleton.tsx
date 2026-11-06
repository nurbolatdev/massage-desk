import { cn } from "@/lib/utils";

const rows = [0, 1, 2, 3];

export function PageSkeleton({ fullPage = false }: { fullPage?: boolean }) {
  return (
    <div
      aria-busy="true"
      className={cn(fullPage && "flex min-h-screen flex-col justify-center bg-bg-page px-32 py-28")}
    >
      <div className="flex flex-col gap-12 rounded-16 border border-line bg-surface p-24">
        {rows.map((row) => (
          <div key={row} className="flex items-center gap-12" aria-hidden="true">
            <div className="size-skeleton-avatar rounded-full bg-segment-bg" />
            <div className="flex flex-1 flex-col gap-6">
              <div className="h-14 w-skeleton-line rounded-6 bg-segment-bg" />
              <div className="h-10 w-skeleton-line-s rounded-6 bg-segment-bg" />
            </div>
            <div className="h-14 w-skeleton-bar rounded-6 bg-segment-bg" />
          </div>
        ))}
      </div>
      <span className="sr-only">Загрузка…</span>
    </div>
  );
}
