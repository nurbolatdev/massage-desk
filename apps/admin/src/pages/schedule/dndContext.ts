import { createContext, useContext } from "react";

export const DragInstructionsContext = createContext<string | undefined>(undefined);

/** Returns the DOM id of the hidden drag instructions when inside a draggable grid. */
export function useDragInstructionsId(): string | undefined {
  return useContext(DragInstructionsContext);
}
