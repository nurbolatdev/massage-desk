import { PageMain } from "@/components/PageMain";
import { SETTINGS_SUBTITLE, SETTINGS_TITLE } from "@/lib/data/services";

import { ServicesSection } from "./ServicesSection";

/** Settings page: for now one block with the services list. */
export function SettingsPage() {
  return (
    <PageMain>
      <div className="flex flex-col gap-4">
        <h1 className="text-title text-ink">{SETTINGS_TITLE}</h1>
        <p className="text-body font-normal text-muted">{SETTINGS_SUBTITLE}</p>
      </div>
      <ServicesSection />
    </PageMain>
  );
}
