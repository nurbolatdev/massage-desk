import { isAuthApiError, isAuthRetryableFetchError } from "@supabase/supabase-js";

export const EMPTY_FIELDS_MESSAGE = "Введите email и пароль.";
export const WRONG_CREDENTIALS_MESSAGE = "Неверный email или пароль. Проверьте и попробуйте ещё раз.";
export const OFFLINE_TITLE = "Нет интернета";
export const OFFLINE_HINT = "Проверьте подключение и попробуйте ещё раз.";
export const OFFLINE_MESSAGE = `${OFFLINE_TITLE}. ${OFFLINE_HINT}`;
export const RATE_LIMIT_MESSAGE = "Слишком много попыток. Подождите минуту и попробуйте ещё раз.";
export const GENERIC_MESSAGE = "Не получилось войти. Попробуйте ещё раз через минуту.";

export type SignInValidation = { ok: true; email: string } | { ok: false; message: string };

/** Only emptiness is checked here; the server decides whether the email and password are right. */
export function validateSignIn(email: string, password: string): SignInValidation {
  const trimmed = email.trim();
  if (trimmed === "" || password === "") {
    return { ok: false, message: EMPTY_FIELDS_MESSAGE };
  }
  return { ok: true, email: trimmed };
}

/** Maps a sign-in failure to a Russian text. The server's English message is never shown. */
export function signInErrorMessage(error: unknown): string {
  if (isAuthRetryableFetchError(error)) {
    return OFFLINE_MESSAGE;
  }
  if (isAuthApiError(error)) {
    if (error.status === 429) {
      return RATE_LIMIT_MESSAGE;
    }
    if (error.code === "invalid_credentials" || (error.status === 400 && !error.code)) {
      return WRONG_CREDENTIALS_MESSAGE;
    }
  }
  return GENERIC_MESSAGE;
}
