import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { RestrictToVerticalAxis, SnapModifier } from "@dnd-kit/abstract/modifiers";
import { Accessibility, PointerActivationConstraints, defaultPreset } from "@dnd-kit/dom";
import { DragDropProvider, type DragEndEvent, KeyboardSensor, PointerSensor, useDragDropManager } from "@dnd-kit/react";

import type { Span } from "@/lib/data/calendar";
import { dropTarget, type GridStep } from "@/lib/data/dropTarget";
import { DRAG_CANCELLED, DRAG_INSTRUCTIONS, dragMoveText, dragStartText, dropText } from "@/lib/data/reschedule";
import type { Appointment } from "@/lib/data/schedule";

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
type MoveLike = { operation: DragEndEvent["operation"]; by?: { x: number; y: number } };

const ZERO_STEP: GridStep = { x: 0, y: 0 };
const BASE_PLUGINS = defaultPreset.plugins.filter((plugin) => plugin !== Accessibility);

function measureStep(root: HTMLElement | null): GridStep {
  const col = root?.querySelector("[data-grid-column]");
  if (!col) return ZERO_STEP;
  const x = col.getBoundingClientRect().width;
  const y = parseFloat(getComputedStyle(col).gridAutoRows);
  return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 };
}

function resolveTarget(state: DndState, { operation: { source, transform }, by }: MoveLike) {
  const appointment = source ? state.byId.get(String(source.id)) : undefined;
  if (!appointment) return null;
  const start = dropTarget({
    appointment,
    days: state.days,
    range: state.range,
    timeZone: state.timeZone,
    dx: transform.x + (by?.x ?? 0),
    dy: transform.y + (by?.y ?? 0),
    step: state.step,
  });
  return start ? { appointment, start } : null;
}

function DndAccessibility({ state }: { state: DndState }) {
  const manager = useDragDropManager();
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!manager) return;
    manager.registry.plugins.unregister(Accessibility);
    manager.registry.plugins.register(Accessibility, {
      screenReaderInstructions: { draggable: DRAG_INSTRUCTIONS },
      announcements: {
        dragstart: ({ operation: { source } }) => {
          const cur = stateRef.current;
          const a = source ? cur.byId.get(String(source.id)) : undefined;
          return a ? dragStartText(a, cur.timeZone) : undefined;
        },
        dragmove: (event) => {
          const cur = stateRef.current;
          const target = resolveTarget(cur, event);
          return target ? dragMoveText(target.start, cur.timeZone) : undefined;
        },
        dragend: (event) => {
          if (event.canceled) return DRAG_CANCELLED;
          const cur = stateRef.current;
          return dropText(resolveTarget(cur, event)?.start ?? null, cur.timeZone);
        },
      },
    });
    return () => manager.registry.plugins.unregister(Accessibility);
  }, [manager]);

  return null;
}

/** Drag-and-drop provider for schedule grids; measures column/row step from the DOM. */
export function CalendarDnd({ days, range, timeZone, appointments, vertical = false, onDrop, children }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<GridStep>(ZERO_STEP);

  useEffect(() => {
    const root = rootRef.current;
    const col = root?.querySelector("[data-grid-column]") ?? null;
    const update = () => {
      const next = measureStep(root);
      setStep((prev) => (prev.x === next.x && prev.y === next.y ? prev : next));
    };
    update();
    if (!col || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(col);
    return () => observer.disconnect();
  }, []);

  const byId = useMemo(() => new Map(appointments.map((a) => [a.id, a])), [appointments]);
  const dndState = useMemo<DndState>(() => ({ byId, days, range, timeZone, step }), [byId, days, range, timeZone, step]);

  const sensors = useMemo(
    () => [
      PointerSensor.configure({ activationConstraints: [new PointerActivationConstraints.Distance({ value: 8 })] }),
      KeyboardSensor.configure({
        offset: step,
        keyboardCodes: { ...KeyboardSensor.defaults.keyboardCodes, start: ["Space"], end: ["Space", "Enter"], cancel: ["Escape"] },
      }),
    ],
    [step],
  );

  const modifiers = useMemo(
    () => [
      ...(step.y > 0 ? [SnapModifier.configure({ size: { x: step.x > 0 ? step.x : 1, y: step.y } })] : []),
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
      <DragDropProvider sensors={sensors} modifiers={modifiers} plugins={BASE_PLUGINS} onDragEnd={handleDragEnd}>
        <DndAccessibility state={dndState} />
        {children}
      </DragDropProvider>
    </div>
  );
}
