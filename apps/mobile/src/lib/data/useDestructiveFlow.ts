import { useEffect, useState } from "react";

import type { AppointmentAction } from "./appointmentActions";
import { actionErrorText } from "./appointmentCard";
import { IDLE, createDestructiveFlow, type FlowState } from "./destructiveFlow";

type Perform = (kind: AppointmentAction) => Promise<unknown>;

export function useDestructiveFlow(perform: Perform) {
  const [state, setState] = useState<FlowState>(IDLE);
  const [flow] = useState(() => createDestructiveFlow({ perform, onChange: setState, errorText: actionErrorText }));

  useEffect(() => {
    flow.setPerform(perform);
  }, [flow, perform]);

  return { state, ask: flow.ask, dismiss: flow.dismiss, confirm: flow.confirm };
}
