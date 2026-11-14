import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { Accessibility, PointerActivationConstraints, defaultPreset } from "@dnd-kit/dom";
import {
  DragDropProvider,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDragDropMonitor,
} from "@dnd-kit/react";

import type { Span } from "@/lib/data/calendar";
import { dropTarget, type GridStep } from "@/lib/data/dropTarget";
import { DRAG_CANCELLED, DRAG_INSTRUCTIONS, dragMoveText, dragStartText, dropText } from "@/lib/data/reschedule";
import type { Appointment } from "@/lib/data/schedule";

import { DragInstructionsContext } from "./dndContext";
import { RoundSnapModifier } from "./snapModifier";

type Props = {
  days: readonly string[];
  range: Span;
  timeZone: string;
  appointments: readonly Appointment[];
  vertical?: boolean;
  onDrop?: (appointment: Appointment, start: Date) => void;
  children: ReactNode;
};

type DndState = { byId: Map<string, Appointment>; days: readonly string[]; range: Span; timeZone: string; step: GridStep };
type MoveLike = {
  operation: DragEndEvent["operation"];
  by?: { x: number; y: number };
  to?: { x: number; y: number };
};

const ZERO_STEP: GridStep = { x: 0, y: 0 };
const BASE_PLUGINS = defaultPreset.plugins.filter((plugin) => plugin !== Accessibility);

function measureStep(root: HTMLElement | null): GridStep {
  const col = root?.querySelector("[data-grid-column]");
  if (!col) return ZERO_STEP;
  const x = col.getBoundingClientRect().width;
  const y = parseFloat(getComputedStyle(col).gridAutoRows);
  return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 };
}

function resolveTarget(state: DndState, { operation: { source, transform, position }, by, to }: MoveLike) {
  const appointment = source ? state.byId.get(String(source.id)) : undefined;
  if (!appointment) return null;
  const dx = to ? to.x - position.initial.x : transform.x + (by?.x ?? 0);
  const dy = to ? to.y - position.initial.y : transform.y + (by?.y ?? 0);
  const start = dropTarget({
    appointment,
    days: state.days,
    range: state.range,
    timeZone: state.timeZone,
    dx,
    dy,
    step: state.step,
  });
  return start ? { appointment, start } : null;
}

function DndAnnouncer({ state }: { state: DndState }) {
  const [announcement, setAnnouncement] = useState("");
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const handlers = useMemo(
    () => ({
      onDragStart: ({ operation: { source } }: DragStartEvent) => {
        const cur = stateRef.current;
        const a = source ? cur.byId.get(String(source.id)) : undefined;
        if (a) setAnnouncement(dragStartText(a, cur.timeZone));
      },
      onDragMove: (event: DragMoveEvent) => {
        const cur = stateRef.current;
        const target = resolveTarget(cur, event);
        if (target) setAnnouncement(dragMoveText(target.start, cur.timeZone));
      },
      onDragEnd: (event: DragEndEvent) => {
        if (event.canceled) {
          setAnnouncement(DRAG_CANCELLED);
          return;
        }
        const cur = stateRef.current;
        setAnnouncement(dropText(resolveTarget(cur, event)?.start ?? null, cur.timeZone));
      },
    }),
    [],
  );

  useDragDropMonitor(handlers);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement}
    </div>
  );
}

/** Drag-and-drop provider for schedule grids; measures column/row step from the DOM. */
export function CalendarDnd({ days, range, timeZone, appointments, vertical = false, onDrop, children }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const instructionsId = useId();
  const [step, setStep] = useState<GridStep>(ZERO_STEP);

  useEffect(() => {
    const root = rootRef.current;
    const update = () => {
      const next = measureStep(root);
      setStep((prev) => (prev.x === next.x && prev.y === next.y ? prev : next));
    };
    update();
    if (!root || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const byId = useMemo(() => new Map(appointments.map((a) => [a.id, a])), [appointments]);
  const dndState = useMemo<DndState>(() => ({ byId, days, range, timeZone, step }), [byId, days, range, timeZone, step]);

  const sensors = useMemo(
    () => [
      PointerSensor.configure({ activationConstraints: [new PointerActivationConstraints.Distance({ value: 8 })] }),
      KeyboardSensor.configure({
        offset: step,
        keyboardCodes: {
          ...KeyboardSensor.defaults.keyboardCodes,
          start: ["Space"],
          end: ["Space", "Enter"],
          cancel: ["Escape", "Tab"],
        },
      }),
    ],
    [step],
  );

  const modifiers = useMemo(
    () => [
      ...(step.y > 0 ? [RoundSnapModifier.configure({ size: step })] : []),
      ...(vertical ? [RestrictToVerticalAxis] : []),
    ],
    [step, vertical],
  );

  function handleDragEnd(event: DragEndEvent) {
    if (event.canceled || !onDrop) return;
    const target = resolveTarget(dndState, event);
    if (target) onDrop(target.appointment, target.start);
  }

  return (
    <div ref={rootRef}>
      <DragInstructionsContext.Provider value={onDrop ? instructionsId : undefined}>
        <DragDropProvider sensors={sensors} modifiers={modifiers} plugins={BASE_PLUGINS} onDragEnd={handleDragEnd}>
          <DndAnnouncer state={dndState} />
          {onDrop && (
            <span id={instructionsId} className="sr-only">
              {DRAG_INSTRUCTIONS}
            </span>
          )}
          {children}
        </DragDropProvider>
      </DragInstructionsContext.Provider>
    </div>
  );
}
