import { CircleAlert, Lock, RefreshCw, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

import { PageSkeleton } from "@/components/PageSkeleton";
import { SignOutButton } from "@/components/SignOutButton";
import { StateCard } from "@/components/StateCard";
import { icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { SESSION_OFFLINE_TEXT, SESSION_OFFLINE_TITLE, accessView } from "@/lib/auth/access";
import { useAuth } from "@/lib/auth/authContext";
import { supabase } from "@/lib/auth/supabase";
import { RoleContext } from "@/lib/auth/roleContext";
import { useRole } from "@/lib/auth/useRole";

function FullPage({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-col justify-center bg-bg-page px-32 py-28">{children}</div>;
}

export function AccessGate({ children }: { children: ReactNode }) {
  const hasSession = useAuth().session !== null;
  const { data: role, isPending, isError, refetch } = useRole();
  const view = accessView({ hasSession, isPending, isError, role });

  if (view === "offline") {
    return (
      <FullPage>
        <StateCard
          icon={WifiOff}
          title={SESSION_OFFLINE_TITLE}
          text={SESSION_OFFLINE_TEXT}
          action={
            // Reading the session refreshes an expired token; the auth provider picks up the result.
            <Button variant="secondary" onClick={() => void supabase.auth.getSession()}>
              <RefreshCw size={icon.button} strokeWidth={icon.stroke} aria-hidden="true" />
              Повторить
            </Button>
          }
        />
      </FullPage>
    );
  }
  if (view === "loading") {
    return <PageSkeleton fullPage />;
  }
  if (view === "error") {
    return (
      <FullPage>
        <StateCard
          icon={CircleAlert}
          title="Не удалось проверить доступ"
          text="Сервер не ответил. Проверьте интернет и попробуйте ещё раз."
          action={
            <Button variant="secondary" onClick={() => void refetch()}>
              <RefreshCw size={icon.button} strokeWidth={icon.stroke} aria-hidden="true" />
              Повторить
            </Button>
          }
        />
      </FullPage>
    );
  }
  if (view === "denied" || role === null || role === undefined) {
    return (
      <FullPage>
        <StateCard
          icon={Lock}
          title="Нет доступа к админке"
          text="Этот аккаунт не может открыть админку. Попросите Нурболата, если нужно."
          action={<SignOutButton variant="secondary" />}
        />
      </FullPage>
    );
  }
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}
