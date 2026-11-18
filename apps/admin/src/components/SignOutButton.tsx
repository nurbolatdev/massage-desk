import { LogOut } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/authContext";

type SignOutButtonProps = { variant: "ghost-on-dark" | "secondary" };

export function SignOutButton({ variant }: SignOutButtonProps) {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const confirm = async () => {
    setBusy(true);
    setError(undefined);
    const done = await signOut();
    setBusy(false);
    if (!done) {
      setError("Не получилось выйти. Проверьте интернет и попробуйте ещё раз.");
    }
  };

  return (
    <>
      <Button
        variant={variant}
        onClick={() => {
          setError(undefined);
          setOpen(true);
        }}
      >
        <LogOut size={icon.button} strokeWidth={icon.stroke} aria-hidden="true" />
        Выйти
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Выйти из аккаунта?"
        text="Чтобы снова войти, понадобятся email и пароль. Если не помните — их знает Нурболат."
        confirmLabel="Да, выйти"
        cancelLabel="Нет, оставить"
        onConfirm={() => void confirm()}
        busy={busy}
        error={error}
      />
    </>
  );
}
