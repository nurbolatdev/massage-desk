import { useEffect, useState } from "react";

import type { AppointmentAction } from "./appointmentActions";
import { actionErrorText } from "./appointmentCard";
import { IDLE, createDestructiveFlow, type FlowState } from "./destructiveFlow";

/** `errorText` is read once, on the first render (like the initial `perform`); `perform` itself stays current. */
export function useDestructiveFlow<K extends string = AppointmentAction>(
  perform: (kind: K) => Promise<unknown>,
  errorText: (error: unknown) => string = actionErrorText,
) {
  const [state, setState] = useState<FlowState<K>>(IDLE);
  const [flow] = useState(() => createDestructiveFlow<K>({ perform, onChange: setState, errorText }));

  useEffect(() => {
    flow.setPerform(perform);
  }, [flow, perform]);

  return { state, ask: flow.ask, dismiss: flow.dismiss, confirm: flow.confirm };
}
