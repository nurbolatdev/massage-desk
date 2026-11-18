import { FILTER_LABEL, SEGMENT_FILTERS } from "@/lib/data/clientList";
import type { SegmentFilter } from "@/lib/data/clients";

const CHIP = "h-target-s rounded-full border px-14 text-body font-semibold";
const CHIP_ON = "border-ink bg-ink text-surface";
const CHIP_OFF = "border-border-strong bg-surface text-ink";

/** Segment chips above the clients table; the selected one is pressed. */
export function ClientFilters({
  value,
  onChange,
}: {
  value: SegmentFilter;
  onChange: (next: SegmentFilter) => void;
}) {
  return (
    <div role="group" aria-label={FILTER_LABEL} className="flex flex-wrap gap-8">
      {SEGMENT_FILTERS.map((f) => {
        const on = f.value === value;
        return (
          <button
            key={f.value}
            type="button"
            aria-pressed={on}
            className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}
            onClick={() => onChange(f.value)}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
