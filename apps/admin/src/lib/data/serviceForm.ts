import type { components } from "@massage-desk/api-types";

import type { createApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import { formatAmount, type Service } from "./services";

type Api = ReturnType<typeof createApi>;

export type CreateServiceBody = components["schemas"]["CreateServiceRequest"];
export type UpdateServiceBody = components["schemas"]["UpdateServiceRequest"];
export type ServiceDraft = { name: string; duration: string; price: string };
export type ServiceValues = { name: string; durationMin: number; price: number };
export type ServiceField = "name" | "duration" | "price";
export type FieldProblems = Partial<Record<ServiceField, string>>;
export type ServiceSave =
  | { id: null; body: CreateServiceBody }
  | { id: string; body: UpdateServiceBody };
export type SaveOutcome = "saved" | "hidden" | "shown";
export type ServiceSaveErrorKind = "offline" | "invalid" | "notFound" | "failed";

export const FIELD_ORDER: readonly ServiceField[] = ["name", "duration", "price"];

export const ADD_SERVICE_LABEL = "Добавить услугу";
export const EDIT_LABEL = "Изменить";
export const SERVICE_TITLE = "Услуга";
export const NEW_SERVICE_TITLE = "Новая услуга";
export const NAME_LABEL = "Название";
export const DURATION_LABEL = "Длительность, мин";
export const PRICE_LABEL = "Цена, ₸";
export const HIDE_SERVICE_LABEL = "Скрыть услугу";
export const SHOW_SERVICE_LABEL = "Показать услугу";
export const CANCEL_LABEL = "Отмена";
export const SAVE_SERVICE_LABEL = "Сохранить";
export const HIDDEN_HINT = "Услуга скрыта: бот её не предлагает, записать на неё нельзя.";
export const NAME_EMPTY = "Введите название услуги.";
export const NAME_TOO_LONG = "Название — не длиннее 100 знаков.";
export const DURATION_INVALID = "Укажите длительность в минутах: от 5 до 480.";
export const PRICE_INVALID = "Укажите цену в тенге, например 8000.";

const MAX_NAME = 100;
const DURATION_PATTERN = /^\d{1,3}$/;
// same limits as the API: 10 digits, 2 after the comma
const PRICE_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

const SAVE_ERRORS: Record<Exclude<ServiceSaveErrorKind, "failed">, string> = {
  offline: "Нет связи с сервером. Услуга не сохранена — нажмите «Сохранить», когда интернет вернётся.",
  invalid: "Сервер не принял услугу. Проверьте название, длительность и цену.",
  notFound: "Эта услуга не найдена. Закройте окно — список обновится.",
};

export function draftFrom(service: Service | null): ServiceDraft {
  if (!service) return { name: "", duration: "", price: "" };
  return {
    name: service.name,
    duration: String(service.durationMin),
    price: formatAmount(service.price),
  };
}

export function checkDraft(draft: ServiceDraft): {
  values: ServiceValues | null;
  problems: FieldProblems;
} {
  const problems: FieldProblems = {};
  const name = draft.name.trim();
  if (name === "") problems.name = NAME_EMPTY;
  else if (name.length > MAX_NAME) problems.name = NAME_TOO_LONG;

  const durationText = draft.duration.trim();
  const durationMin = DURATION_PATTERN.test(durationText) ? Number(durationText) : NaN;
  if (!(durationMin >= 5 && durationMin <= 480)) problems.duration = DURATION_INVALID;

  const priceText = draft.price.replace(/\s/g, "").replace(",", ".");
  const price = PRICE_PATTERN.test(priceText) ? Number(priceText) : NaN;
  if (Number.isNaN(price)) problems.price = PRICE_INVALID;

  if (Object.keys(problems).length > 0) return { values: null, problems };
  return { values: { name, durationMin, price }, problems };
}

export function createBody(values: ServiceValues): CreateServiceBody {
  return { name: values.name, durationMin: values.durationMin, price: values.price };
}

export function updateBody(
  service: Service,
  values: ServiceValues,
  active?: boolean,
): UpdateServiceBody {
  const body: UpdateServiceBody = {};
  if (values.name !== service.name) body.name = values.name;
  if (values.durationMin !== service.durationMin) body.durationMin = values.durationMin;
  if (values.price !== service.price) body.price = values.price;
  if (active !== undefined && active !== service.active) body.active = active;
  return body;
}

export function isEmptyBody(body: UpdateServiceBody): boolean {
  return Object.keys(body).length === 0;
}

export function saveService(api: Api, save: ServiceSave): Promise<Service> {
  if (save.id === null) return unwrap(api.POST("/services", { body: save.body }));
  return unwrap(
    api.PATCH("/services/{id}", { params: { path: { id: save.id } }, body: save.body }),
  );
}

/** A new service goes last, as on the server. */
export function upsertService(list: Service[] | undefined, saved: Service): Service[] | undefined {
  if (!list) return list;
  if (!list.some((s) => s.id === saved.id)) return [...list, saved];
  return list.map((s) => (s.id === saved.id ? saved : s));
}

export function savedText(outcome: SaveOutcome, name: string): string {
  if (outcome === "hidden") return `Услуга «${name}» скрыта — бот её не предлагает.`;
  if (outcome === "shown") return `Услуга «${name}» снова доступна для записи.`;
  return `Сохранено: «${name}».`;
}

export function editLabel(name: string): string {
  return `${EDIT_LABEL}: ${name}`;
}

export function serviceSaveErrorKind(error: unknown): ServiceSaveErrorKind {
  if (!(error instanceof ApiError)) return "failed";
  if (error.kind === "network") return "offline";
  if (error.code === "INVALID_REQUEST") return "invalid";
  if (error.code === "SERVICE_NOT_FOUND") return "notFound";
  return "failed";
}

export function serviceSaveErrorText(kind: ServiceSaveErrorKind, error: unknown): string {
  if (kind !== "failed") return SAVE_ERRORS[kind];
  if (error instanceof ApiError && error.status !== undefined) {
    return `Сервер ответил с ошибкой. Код: ${error.status}. Услуга не сохранена.`;
  }
  return "Услуга не сохранена. Попробуйте ещё раз через минуту.";
}
