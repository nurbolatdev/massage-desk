import { Link, useLocation } from "@tanstack/react-router";

import { icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import { isActive, type Section } from "@/sections";

type SideNavProps = {
  sections: readonly Section[];
  variant: "sidebar" | "menu";
  onNavigate?: () => void;
};

const ITEM = "flex min-h-target items-center rounded-10 text-body font-semibold";
const ITEM_IDLE = "text-on-primary-muted hover:bg-stone-mid";
const ITEM_ACTIVE = "bg-primary text-surface";
const SPACING = { sidebar: "gap-12 p-12", menu: "gap-10 px-14 py-12" } as const;
const ACTIVE_WEIGHT = { sidebar: "font-bold", menu: "font-semibold" } as const;

export function SideNav({ sections, variant, onNavigate }: SideNavProps) {
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
            className={cn(ITEM, SPACING[variant], active ? [ITEM_ACTIVE, ACTIVE_WEIGHT[variant]] : ITEM_IDLE)}
          >
            <Icon size={icon.nav} strokeWidth={icon.stroke} aria-hidden="true" />
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
