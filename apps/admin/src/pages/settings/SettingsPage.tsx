import { useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { PageMain } from "@/components/PageMain";
import { BUSINESS_TITLE, SETTINGS_TABS_LABEL } from "@/lib/data/businessSettings";
import { SERVICES_TITLE, SETTINGS_SUBTITLE, SETTINGS_TITLE } from "@/lib/data/services";

import { BusinessSettingsSection } from "./BusinessSettingsSection";
import { ServicesSection } from "./ServicesSection";

const TABS = [
  ["services", SERVICES_TITLE],
  ["business", BUSINESS_TITLE],
] as const;

/** Settings page: tabs "Services and prices" and "Address and time zone"; only the active panel is mounted. */
export function SettingsPage() {
  const [tab, setTab] = useState(0);
  const base = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const panelId = `${base}-panel`;

  function select(next: number) {
    setTab(next);
    tabs.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = TABS.length - 1;
    const moves: Record<string, number> = {
      ArrowRight: tab === last ? 0 : tab + 1,
      ArrowLeft: tab === 0 ? last : tab - 1,
      Home: 0,
      End: last,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next);
  }

  return (
    <PageMain>
      <div className="flex flex-col gap-4">
        <h1 className="text-title text-ink">{SETTINGS_TITLE}</h1>
        <p className="text-body font-normal text-muted">{SETTINGS_SUBTITLE}</p>
      </div>
      <div
        role="tablist"
        aria-label={SETTINGS_TABS_LABEL}
        onKeyDown={onKeyDown}
        className="flex flex-wrap gap-4 border-b border-line"
      >
        {TABS.map(([key, label], index) => {
          const selected = index === tab;
          return (
            <button
              key={key}
              ref={(el) => {
                tabs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-${key}`}
              aria-selected={selected}
              aria-controls={selected ? panelId : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(index)}
              className={`relative h-target px-16 text-body font-bold ${selected ? "text-ink" : "text-muted"}`}
            >
              {label}
              {selected && (
                <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={panelId} aria-labelledby={`${base}-${TABS[tab]?.[0]}`}>
        {tab === 0 ? <ServicesSection /> : <BusinessSettingsSection />}
      </div>
    </PageMain>
  );
}
