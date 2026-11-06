import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { icon } from "@/components/icon";

type StateCardProps = { icon: LucideIcon; title: string; text: string; action?: ReactNode };

export function StateCard({ icon: Icon, title, text, action }: StateCardProps) {
  return (
    <div className="flex flex-col justify-center gap-12 rounded-16 border border-line bg-surface p-24">
      <div className="flex flex-col items-center gap-10 text-center">
        <span className="flex size-56 items-center justify-center rounded-14 bg-segment-bg text-primary-strong">
          <Icon size={icon.state} strokeWidth={icon.stroke} aria-hidden="true" />
        </span>
        <h2 className="text-subtitle text-ink">{title}</h2>
        <p className="max-w-state-text text-body text-muted">{text}</p>
        {action}
      </div>
    </div>
  );
}
