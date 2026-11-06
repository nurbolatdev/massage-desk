import { useQueryClient } from "@tanstack/react-query";
import { Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { BrandLogo } from "@/components/BrandLogo";
import { OfflineBanner } from "@/components/OfflineBanner";
import { SideNav } from "@/components/SideNav";
import { SignOutButton } from "@/components/SignOutButton";
import { icon } from "@/components/icon";
import { useStaffRole } from "@/lib/auth/roleContext";
import { useOnline } from "@/lib/useOnline";
import { visibleSections } from "@/sections";

const MENU_ID = "phone-menu";

export function AppShell({ children }: { children: ReactNode }) {
  const role = useStaffRole();
  const online = useOnline();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const items = visibleSections(role);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <div className="flex min-h-screen flex-col bg-bg-page text-ink md:flex-row">
      <aside className="sticky top-0 hidden h-screen w-sidebar shrink-0 flex-col gap-24 bg-stone-dark px-16 py-24 md:flex">
        <div className="px-8">
          <BrandLogo mark={34} text="title-s" />
        </div>
        <SideNav sections={items} variant="sidebar" />
        <div className="mt-auto">
          <SignOutButton variant="ghost-on-dark" />
        </div>
      </aside>

      <header className="flex items-center gap-10 bg-stone-dark px-16 py-14 md:hidden">
        <button
          type="button"
          aria-label="Меню"
          aria-expanded={menuOpen}
          aria-controls={MENU_ID}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex size-target items-center justify-center rounded-10 bg-stone-mid text-surface"
        >
          {menuOpen ? (
            <X size={icon.menu} strokeWidth={icon.stroke} aria-hidden="true" />
          ) : (
            <Menu size={icon.menu} strokeWidth={icon.stroke} aria-hidden="true" />
          )}
        </button>
        <BrandLogo mark={28} text="subtitle" />
      </header>
      <div
        id={MENU_ID}
        hidden={!menuOpen}
        className="flex flex-col gap-12 bg-stone-dark pt-4 pr-12 pb-14 pl-12 md:hidden"
      >
        <SideNav sections={items} variant="menu" onNavigate={() => setMenuOpen(false)} />
        <SignOutButton variant="ghost-on-dark" />
      </div>

      <div className="min-w-0 flex-1">
        {!online && (
          <div className="px-14 pt-20 md:px-32 md:pt-28">
            <OfflineBanner onRetry={() => void queryClient.refetchQueries({ type: "active" })} />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
