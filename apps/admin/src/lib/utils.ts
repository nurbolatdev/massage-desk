import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The font-size names from the @theme block in styles/index.css.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["hero", "title", "title-s", "subtitle", "body", "secondary", "label"],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
