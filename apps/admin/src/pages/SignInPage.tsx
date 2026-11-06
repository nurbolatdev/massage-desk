import { useRef, useState, type FormEvent } from "react";

import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setRemember, supabase } from "@/lib/auth/supabase";
import { signInErrorMessage, validateSignIn } from "@/lib/auth/signInErrors";

const ERROR_ID = "sign-in-error";

export function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRememberChecked] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const checked = validateSignIn(email, password);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    setRemember(remember);
    try {
      const { error: failure } = await supabase.auth.signInWithPassword({
        email: checked.email,
        password,
      });
      // On success the router sees the new session and leaves this page.
      if (failure) setError(signInErrorMessage(failure));
    } catch (failure) {
      setError(signInErrorMessage(failure));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-wrap bg-bg-page text-ink">
      <aside className="flex shrink grow basis-aside-basis flex-col justify-between gap-40 bg-stone-dark p-48 text-on-primary-muted">
        <BrandLogo mark={44} text="title-s" />
        <div className="flex max-w-aside-text flex-col gap-14">
          <h1 className="text-hero text-surface">Админка</h1>
          <p className="text-subtitle leading-body font-medium text-on-primary-muted">
            Расписание, клиенты, переписка бота и отчёты — в одном месте.
          </p>
        </div>
        <span className="text-secondary font-medium text-on-primary-muted">
          Доступ только для мастера и администратора
        </span>
      </aside>
      <main className="flex shrink grow-999 basis-main-basis items-center justify-center px-24 py-48">
        <form
          noValidate
          onSubmit={onSubmit}
          className="flex w-full max-w-form flex-col gap-20 rounded-18 border border-line bg-surface p-32"
        >
          <h2 className="text-title">Вход</h2>
          <div className="flex w-full flex-col gap-6">
            <Label htmlFor="sign-in-email">Email</Label>
            <Input
              id="sign-in-email"
              type="email"
              autoComplete="username"
              value={email}
              disabled={busy}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
            />
          </div>
          <div className="flex w-full flex-col gap-6">
            <Label htmlFor="sign-in-password">Пароль</Label>
            <Input
              id="sign-in-password"
              type="password"
              autoComplete="current-password"
              value={password}
              disabled={busy}
              aria-invalid={error !== null}
              aria-describedby={error !== null ? ERROR_ID : undefined}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
            />
            {error !== null && (
              <span id={ERROR_ID} role="alert" className="text-secondary text-danger">
                {error}
              </span>
            )}
          </div>
          <Label htmlFor="sign-in-remember" className="flex min-h-target items-center gap-10 text-body font-medium text-ink">
            <Checkbox
              id="sign-in-remember"
              checked={remember}
              disabled={busy}
              onCheckedChange={(value) => setRememberChecked(value === true)}
            />
            Запомнить на этом компьютере
          </Label>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Входим…" : "Войти"}
          </Button>
          <p className="text-secondary font-medium text-muted">
            Регистрации нет. Новых пользователей добавляет администратор в «Настройки → Пользователи».
          </p>
        </form>
      </main>
    </div>
  );
}
