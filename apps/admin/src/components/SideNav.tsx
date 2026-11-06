import { Link, useLocation } from "@tanstack/react-router";

import { icon } from "@/components/icon";
import { isActive, type Section } from "@/sections";

type SideNavProps = { sections: readonly Section[]; onNavigate?: () => void };

const ITEM =
  "flex min-h-target items-center gap-12 rounded-10 p-12 text-body font-semibold text-on-primary-muted hover:bg-stone-mid";
const ITEM_ACTIVE = "flex min-h-target items-center gap-12 rounded-10 bg-primary p-12 text-body font-bold text-surface";

export function SideNav({ sections, onNavigate }: SideNavProps) {
  const pathname = useLocation({ select: (location) => location.pathname });
  return (
    <nav aria-label="Разделы админки" className="flex flex-col gap-2">
      {sections.map((section) => {
        const active = isActive(pathname, section);
        const Icon = section.icon;
        return (
          <Link
            key={section.id}
            to={section.path}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={active ? ITEM_ACTIVE : ITEM}
          >
            <Icon size={icon.nav} strokeWidth={icon.stroke} aria-hidden="true" />
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
