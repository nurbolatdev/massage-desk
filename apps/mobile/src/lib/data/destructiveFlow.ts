import type { AppointmentAction } from "./appointmentActions";

export interface FlowState<K extends string = AppointmentAction> {
  asking: K | null;
  busy: boolean;
  error: string | null;
}

export const IDLE: FlowState<never> = { asking: null, busy: false, error: null };

export interface DestructiveFlowOptions<K extends string = AppointmentAction> {
  perform: (kind: K) => Promise<unknown>;
  onChange: (state: FlowState<K>) => void;
  errorText: (error: unknown) => string;
}

export interface DestructiveFlow<K extends string = AppointmentAction> {
  ask: (kind: K) => void;
  dismiss: () => void;
  confirm: () => Promise<void>;
  setPerform: (perform: DestructiveFlowOptions<K>["perform"]) => void;
  state: () => FlowState<K>;
}

/**
 * Two-step flow: `ask` only opens the confirmation, and `confirm` is the
 * only place that performs the action.
 */
export function createDestructiveFlow<K extends string = AppointmentAction>({
  perform: initial,
  onChange,
  errorText,
}: DestructiveFlowOptions<K>): DestructiveFlow<K> {
  let perform = initial;
  let state: FlowState<K> = IDLE;
  const set = (next: FlowState<K>) => {
    state = next;
    onChange(next);
  };

  return {
    state: () => state,
    setPerform(next) {
      perform = next;
    },
    ask(kind) {
      if (state.busy) return;
      set({ asking: kind, busy: false, error: null });
    },
    dismiss() {
      if (state.busy) return;
      set(IDLE);
    },
    async confirm() {
      const kind = state.asking;
      if (kind === null || state.busy) return;
      set({ asking: kind, busy: true, error: null });
      try {
        await perform(kind);
        set(IDLE);
      } catch (e) {
        set({ asking: kind, busy: false, error: errorText(e) });
      }
    },
  };
}
