import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-8 rounded-10 px-16 text-body font-bold whitespace-nowrap disabled:pointer-events-none disabled:bg-disabled-bg disabled:text-neutral-fg",
  {
    variants: {
      variant: {
        primary: "bg-primary text-surface active:bg-primary-strong",
        secondary:
          "border border-border-strong bg-surface text-ink active:bg-segment-bg",
        destructive:
          "border border-danger-border bg-surface text-danger active:bg-danger-soft disabled:border-disabled-bg",
        "destructive-solid": "bg-danger text-surface active:bg-danger-strong",
        "ghost-on-dark":
          "bg-transparent font-semibold text-on-primary-muted hover:bg-stone-mid disabled:bg-transparent",
      },
      size: {
        default: "h-target",
        small: "h-target-s",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);
