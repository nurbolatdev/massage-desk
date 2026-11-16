import { User } from "lucide-react";

import { icon } from "@/components/icon";
import { clientInitials } from "@/lib/data/clients";

const SIZE_STYLES = {
  row: {
    box: "size-skeleton-avatar bg-primary-soft text-secondary text-primary-strong",
    icon: icon.button,
  },
  card: {
    box: "size-48 bg-primary text-subtitle text-surface",
    icon: icon.state,
  },
} as const;

/** Circular client avatar showing initials or a fallback user icon when name is absent. */
export function ClientAvatar({
  name,
  size = "row",
}: {
  name: string | null;
  size?: "row" | "card";
}) {
  const initials = clientInitials(name);
  const style = SIZE_STYLES[size];
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-extrabold ${style.box}`}
    >
      {initials || <User size={style.icon} strokeWidth={icon.stroke} />}
    </span>
  );
}
