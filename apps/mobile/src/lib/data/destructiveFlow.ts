import type { AppointmentAction } from "./appointmentActions";

export interface FlowState {
  asking: AppointmentAction | null;
  busy: boolean;
  error: string | null;
}

export const IDLE: FlowState = { asking: null, busy: false, error: null };

export interface DestructiveFlowOptions {
  perform: (kind: AppointmentAction) => Promise<unknown>;
  onChange: (state: FlowState) => void;
  errorText: (error: unknown) => string;
}

export interface DestructiveFlow {
  ask: (kind: AppointmentAction) => void;
  dismiss: () => void;
  confirm: () => Promise<void>;
  setPerform: (perform: DestructiveFlowOptions["perform"]) => void;
  state: () => FlowState;
}

/**
 * Two-step flow: `ask` only opens the confirmation, and `confirm` is the
 * only place that performs the action.
 */
export function createDestructiveFlow({ perform: initial, onChange, errorText }: DestructiveFlowOptions): DestructiveFlow {
  let perform = initial;
  let state: FlowState = IDLE;
  const set = (next: FlowState) => {
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
