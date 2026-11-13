import type { ComponentType } from "react";
import { Clock, Lock } from "lucide-react";

import { PageMain } from "@/components/PageMain";
import { StateCard } from "@/components/StateCard";
import { useStaffRole } from "@/lib/auth/roleContext";
import { canOpen, type Section } from "@/sections";

import { SchedulePage } from "./schedule/SchedulePage";

// Sections that already have a real page; the rest show the placeholder.
const pages: Partial<Record<string, ComponentType>> = { schedule: SchedulePage };

export function SectionPage({ section }: { section: Section }) {
  const role = useStaffRole();
  const Page = pages[section.id];
  if (Page && canOpen(role, section)) return <Page />;
  return (
    <PageMain>
      <h1 className="text-title text-ink">{section.label}</h1>
      {canOpen(role, section) ? (
        <StateCard icon={Clock} title="Раздел появится позже" text={section.description} />
      ) : (
        <StateCard
          icon={Lock}
          title="Раздел только для администратора"
          text="AI-диагностику и систему видит администратор. Попросите Нурболата, если нужно."
        />
      )}
    </PageMain>
  );
}
