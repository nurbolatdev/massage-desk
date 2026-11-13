import { Suspense, lazy, type ComponentType } from "react";
import { Clock, Lock } from "lucide-react";

import { PageMain } from "@/components/PageMain";
import { PageSkeleton } from "@/components/PageSkeleton";
import { StateCard } from "@/components/StateCard";
import { useStaffRole } from "@/lib/auth/roleContext";
import { canOpen, type Section } from "@/sections";

// Sections that already have a real page; the rest show the placeholder.
const SchedulePage = lazy(() => import("./schedule/SchedulePage").then((m) => ({ default: m.SchedulePage })));
const pages: Partial<Record<string, ComponentType>> = { schedule: SchedulePage };

export function SectionPage({ section }: { section: Section }) {
  const role = useStaffRole();
  const Page = pages[section.id];
  if (Page && canOpen(role, section)) return (
      <Suspense fallback={<PageSkeleton />}>
        <Page />
      </Suspense>
    );
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
