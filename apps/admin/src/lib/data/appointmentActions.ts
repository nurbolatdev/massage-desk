import type { createApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import { whenShort } from "./reschedule";
import type { Appointment, AppointmentResponse } from "./schedule";

export type AppointmentAction = "cancel" | "noShow";

/** Cancels an appointment or marks it as no-show on the server. */
export function postAppointmentAction(
  api: ReturnType<typeof createApi>,
  id: string,
  action: AppointmentAction,
): Promise<AppointmentResponse> {
  const params = { params: { path: { id } } };
  return unwrap(
    action === "cancel"
      ? api.POST("/appointments/{id}/cancel", params)
      : api.POST("/appointments/{id}/no-show", params),
  );
}

/** Which actions the panel offers for an appointment at `now`. */
export function panelActions(a: Appointment, now: Date): { cancel: boolean; noShow: boolean } {
  if (a.status !== "confirmed") return { cancel: false, noShow: false };
  const started = a.start.getTime() <= now.getTime();
  return { cancel: !started, noShow: started };
}

export const RESCHEDULE_LABEL = "Перенести";
export const CANCEL_LABEL = "Отменить";
export const NO_SHOW_LABEL = "Не пришёл";

export const ACTION_DIALOG: Record<AppointmentAction, { title: string; confirm: string; back: string }> = {
  cancel: { title: "Отменить запись?", confirm: "Отменить запись", back: "Не отменять" },
  noShow: { title: "Клиент не пришёл?", confirm: "Да, не пришёл", back: "Нет, оставить" },
};

const ACTION_TAILS: Record<AppointmentAction, string> = {
  cancel: "Время станет свободным для бота. Клиенту сообщение не придёт — если нужно, напишите ему сами.",
  noShow: "Запись отметится как «не пришёл». Это видно в истории клиента и в отчётах.",
};

/** Confirmation dialog body naming the client, date/time, service and consequences. */
export function actionText(kind: AppointmentAction, a: Appointment, timeZone: string): string {
  return `${a.clientName}, ${whenShort(a.start, timeZone)} · ${a.serviceName}. ${ACTION_TAILS[kind]}`;
}

export type ActionErrorKind = "gone" | "early" | "offline" | "failed";

/** Maps a failed cancel or no-show request to an error category. */
export function actionErrorKind(error: unknown): ActionErrorKind {
  if (!(error instanceof ApiError)) return "failed";
  if (error.kind === "network") return "offline";
  if (error.code === "NOT_STARTED") return "early";
  if (error.status === 409 || error.status === 404) return "gone";
  return "failed";
}

const ERROR_TEXT: Record<ActionErrorKind, string> = {
  gone: "Запись уже изменилась. Закройте окно — на экране новое состояние.",
  early: "Запись ещё не началась. Отметить «не пришёл» можно после её начала.",
  offline: "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.",
  failed: "Не получилось сохранить. Попробуйте ещё раз через минуту.",
};

/** Russian error message for a failed cancel or no-show attempt shown in the confirm dialog. */
export function actionErrorText(kind: ActionErrorKind): string {
  return ERROR_TEXT[kind];
}
