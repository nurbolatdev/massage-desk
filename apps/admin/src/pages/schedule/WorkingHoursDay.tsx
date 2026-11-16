import { Fragment, useId } from "react";
import { Plus, Trash2 } from "lucide-react";

import { icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WEEKDAYS_LONG } from "@/lib/data/calendar";
import * as wh from "@/lib/data/workingHours";

const EDGES: readonly ("start" | "end")[] = ["start", "end"];

type Props = {
  day: number;
  ranges: readonly wh.HoursRange[];
  disabled: boolean;
  onChange: (update: (draft: wh.WeekDraft) => wh.WeekDraft) => void;
};

/** Single weekday row in the working hours editor: day-off toggle, up to 4 time ranges, and inline error. */
export function WorkingHoursDay({ day, ranges, disabled, onChange }: Props) {
  const baseId = useId();
  const nameId = `${baseId}-name`;
  const dayOffId = `${baseId}-off`;
  const problemId = `${baseId}-problem`;
  const off = ranges.length === 0;
  const problem = wh.dayProblem(ranges);
  const describedBy = problem ? problemId : undefined;

  return (
    <div role="group" aria-labelledby={nameId} className="flex flex-col gap-10 border-b border-divider py-10">
      <div className="flex flex-wrap items-center justify-between gap-12">
        <span id={nameId} className="text-body font-bold text-ink">{WEEKDAYS_LONG[day]}</span>
        <Label htmlFor={dayOffId} className="flex min-h-target items-center gap-10 text-body font-medium text-ink">
          <Checkbox
            id={dayOffId}
            checked={off}
            disabled={disabled}
            onCheckedChange={(value) => onChange((draft) => wh.setDayOff(draft, day, value === true))}
          />
          {wh.DAY_OFF_LABEL}
        </Label>
      </div>
      {!off && (
        <>
          {ranges.map((range, i) => (
            <div key={i} className="flex flex-wrap items-center gap-8">
              {EDGES.map((edge) => (
                <Fragment key={edge}>
                  {edge === "end" && <span aria-hidden="true">–</span>}
                  <Input
                    type="time"
                    className="w-auto"
                    value={range[edge]}
                    disabled={disabled}
                    aria-label={wh.rangeFieldLabel(day, i, edge)}
                    aria-invalid={problem !== null}
                    aria-describedby={describedBy}
                    onChange={(e) => {
                      const patch = edge === "start" ? { start: e.target.value } : { end: e.target.value };
                      onChange((draft) => wh.setRange(draft, day, i, patch));
                    }}
                  />
                </Fragment>
              ))}
              <button
                type="button"
                disabled={disabled}
                aria-label={wh.removeRangeLabel(day, i)}
                onClick={() => onChange((draft) => wh.removeRange(draft, day, i))}
                className="flex size-target items-center justify-center rounded-8 text-muted disabled:pointer-events-none disabled:text-neutral-fg"
              >
                <Trash2 size={icon.nav} strokeWidth={icon.stroke} aria-hidden="true" />
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="small"
            disabled={disabled || !wh.canAddRange(ranges)}
            onClick={() => onChange((draft) => wh.addRange(draft, day))}
            className="self-start"
          >
            <Plus size={icon.button} strokeWidth={icon.stroke} aria-hidden="true" />
            {wh.ADD_RANGE_LABEL}
          </Button>
        </>
      )}
      {problem && <p id={problemId} className="text-secondary text-danger">{wh.DAY_PROBLEM_TEXT[problem]}</p>}
    </div>
  );
}
