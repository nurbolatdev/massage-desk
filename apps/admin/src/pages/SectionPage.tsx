import { Component, Suspense, lazy, type ComponentType, type ReactNode } from "react";
import { Clock, Lock, RefreshCw } from "lucide-react";

import { PageMain } from "@/components/PageMain";
import { PageSkeleton } from "@/components/PageSkeleton";
import { StateCard } from "@/components/StateCard";
import { icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { useStaffRole } from "@/lib/auth/roleContext";
import { canOpen, type Section } from "@/sections";

// Sections that already have a real page; the rest show the placeholder.
const SchedulePage = lazy(() => import("./schedule/SchedulePage").then((m) => ({ default: m.SchedulePage })));
const pages: Partial<Record<string, ComponentType>> = { schedule: SchedulePage };

// Shown when a page chunk cannot be loaded (for example, the connection dropped).
class ChunkErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <PageMain>
        <StateCard
          icon={RefreshCw}
          title="Не удалось открыть раздел"
          text="Проверьте связь и обновите страницу."
          action={
            <Button variant="secondary" onClick={() => window.location.reload()}>
              <RefreshCw size={icon.button} strokeWidth={icon.stroke} aria-hidden="true" />
              Обновить страницу
            </Button>
          }
        />
      </PageMain>
    );
  }
}

export function SectionPage({ section }: { section: Section }) {
  const role = useStaffRole();
  const Page = pages[section.id];
  if (Page && canOpen(role, section)) {
    return (
      <ChunkErrorBoundary>
        <Suspense fallback={<PageSkeleton />}>
          <Page />
        </Suspense>
      </ChunkErrorBoundary>
    );
  }
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
