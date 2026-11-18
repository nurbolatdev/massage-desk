import { CircleAlert, Lock, RefreshCw, WifiOff } from "lucide-react";
import { useState, type ReactNode } from "react";

import { PageSkeleton } from "@/components/PageSkeleton";
import { SignOutButton } from "@/components/SignOutButton";
import { StateCard } from "@/components/StateCard";
import { icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { accessView } from "@/lib/auth/access";
import { useAuth } from "@/lib/auth/authContext";
import { RoleContext } from "@/lib/auth/roleContext";
import { OFFLINE_HINT, OFFLINE_TITLE } from "@/lib/auth/signInErrors";
import { useRole } from "@/lib/auth/useRole";

function FullPage({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-col justify-center bg-bg-page px-32 py-28">{children}</div>;
}

export function AccessGate({ children }: { children: ReactNode }) {
  const { status, session, reloadSession } = useAuth();
  const [reloading, setReloading] = useState(false);
  const { data: role, isPending, isError, refetch } = useRole();
  const view = accessView({
    signedIn: status === "signedIn",
    hasSession: session !== null,
    isPending,
    isError,
    role,
  });

  const retry = async () => {
    setReloading(true);
    try {
      await reloadSession();
    } finally {
      setReloading(false);
    }
  };

  if (view.kind === "offline") {
    return (
      <FullPage>
        <StateCard
          icon={WifiOff}
          title={OFFLINE_TITLE}
          text={OFFLINE_HINT}
          action={
            <Button variant="secondary" disabled={reloading} onClick={() => void retry()}>
              <RefreshCw size={icon.button} strokeWidth={icon.stroke} aria-hidden="true" />
              Повторить
            </Button>
          }
        />
      </FullPage>
    );
  }
  if (view.kind === "loading") {
    return <PageSkeleton fullPage />;
  }
  if (view.kind === "error") {
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
  if (view.kind === "denied") {
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
  return <RoleContext.Provider value={view.role}>{children}</RoleContext.Provider>;
}
