import { type DragOperation, Modifier, configurator } from "@dnd-kit/abstract";
import type { DragDropManager } from "@dnd-kit/dom";

import type { GridStep } from "@/lib/data/dropTarget";

type SnapOptions = {
  size: GridStep;
};

function snapAxis(value: number, step: number): number {
  if (step <= 0) return value;
  const snapped = Math.round(value / step) * step;
  return snapped === 0 ? 0 : snapped;
}

/** Snaps drag coordinates to the nearest grid step using round instead of ceil. */
export class RoundSnapModifier extends Modifier<DragDropManager, SnapOptions> {
  override apply({ transform }: Pick<DragOperation, "transform">) {
    const size = this.options?.size;
    if (!size) return transform;
    return {
      ...transform,
      x: snapAxis(transform.x, size.x),
      y: snapAxis(transform.y, size.y),
    };
  }

  static configure = configurator(RoundSnapModifier);
}
