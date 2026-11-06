import { CircleAlert, Lock } from "lucide-react";
import type { ReactNode } from "react";

import { PageSkeleton } from "@/components/PageSkeleton";
import { SignOutButton } from "@/components/SignOutButton";
import { StateCard } from "@/components/StateCard";
import { Button } from "@/components/ui/button";
import { RoleContext } from "@/lib/auth/roleContext";
import { useRole } from "@/lib/auth/useRole";

function FullPage({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-col justify-center bg-bg-page px-32 py-28">{children}</div>;
}

export function AccessGate({ children }: { children: ReactNode }) {
  const { data: role, isPending, isError, refetch } = useRole();

  if (isPending) {
    return <PageSkeleton fullPage />;
  }
  if (isError) {
    return (
      <FullPage>
        <StateCard
          icon={CircleAlert}
          title="Не удалось проверить доступ"
          text="Сервер не ответил. Проверьте интернет и попробуйте ещё раз."
          action={
            <Button variant="secondary" onClick={() => void refetch()}>
              Повторить
            </Button>
          }
        />
      </FullPage>
    );
  }
  if (role === null) {
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
