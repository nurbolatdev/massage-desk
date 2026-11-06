import { createContext, useContext } from "react";

import type { StaffRole } from "./access";

export const RoleContext = createContext<StaffRole | null>(null);

export function useStaffRole(): StaffRole {
  const value = useContext(RoleContext);
  if (!value) {
    throw new Error("useStaffRole must be used inside AccessGate");
  }
  return value;
}
