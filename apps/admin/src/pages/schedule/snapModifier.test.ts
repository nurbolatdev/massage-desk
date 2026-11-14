import { DragDropManager } from "@dnd-kit/dom";
import { weekDays } from "@massage-desk/shared";
import { describe, expect, it } from "vitest";

import { dropTarget } from "@/lib/data/dropTarget";
import type { Appointment } from "@/lib/data/schedule";

import { RoundSnapModifier } from "./snapModifier";

const TZ = "Asia/Tashkent";
const DAYS = weekDays("2026-11-02");
const RANGE = { start: 9, end: 19 };
const STEP = { x: 100, y: 18.2 };

const MARAT: Appointment = {
  id: "a1",
  clientId: "c1",
  clientName: "Марат Каримов",
  clientPhone: "+77010000000",
  serviceId: "s1",
  serviceName: "Общий",
  start: new Date("2026-11-02T11:00:00Z"),
  end: new Date("2026-11-02T12:00:00Z"),
  status: "confirmed",
  source: "manual",
};

describe("RoundSnapModifier", () => {
  it("snaps a 1-step downward move from a fractional center at step 18.2 to 1 row and ignores dx=+3", () => {
    const manager = new DragDropManager();
    const modifier = new RoundSnapModifier(manager, { size: STEP });
    const fractionalCenterY = 200.3;
    const afterOneStepY = fractionalCenterY + STEP.y;

    const snapped = modifier.apply({
      transform: { x: 3, y: afterOneStepY - fractionalCenterY },
    });

    expect(snapped).toEqual({ x: 0, y: 18.2 });
    const target = dropTarget({
      appointment: MARAT,
      days: DAYS,
      range: RANGE,
      timeZone: TZ,
      dx: snapped.x,
      dy: snapped.y,
      step: STEP,
    });
    expect(target?.toISOString()).toBe("2026-11-02T11:15:00.000Z");
  });

  it("avoids negative zero for small negative deltas and rounds past half a step", () => {
    const manager = new DragDropManager();
    const modifier = new RoundSnapModifier(manager, { size: STEP });

    const zeroed = modifier.apply({ transform: { x: -3, y: -4 } });
    expect(Object.is(zeroed.x, 0)).toBe(true);
    expect(Object.is(zeroed.y, 0)).toBe(true);

    expect(modifier.apply({ transform: { x: 55, y: 10 } })).toEqual({ x: 100, y: 18.2 });
  });
});
