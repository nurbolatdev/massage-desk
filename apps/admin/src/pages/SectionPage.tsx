import { Clock, Lock } from "lucide-react";

import { StateCard } from "@/components/StateCard";
import { useStaffRole } from "@/lib/auth/roleContext";
import { canOpen, type Section } from "@/sections";

export function SectionPage({ section }: { section: Section }) {
  const role = useStaffRole();
  return (
    <main className="flex flex-col gap-20 px-32 pt-28 pb-40">
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
    </main>
  );
}
