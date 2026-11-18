import type { components } from "@massage-desk/api-types";

import type { createApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/client";
import { NBSP } from "@/lib/format";

type Api = ReturnType<typeof createApi>;

export type Service = components["schemas"]["ServiceResponse"];

export const SETTINGS_TITLE = "Настройки";
export const SETTINGS_SUBTITLE = "Изменения сразу видит бот и приложение мастера";
export const SERVICES_TITLE = "Услуги и цены";
export const COLUMN_SERVICE = "Услуга";
export const COLUMN_DURATION = "Длительность";
export const COLUMN_PRICE = "Цена";
export const COLUMN_OFFERED = "Бот предлагает";
export const OFFERED_YES = "Да";
export const OFFERED_NO = "Нет, скрыта";
export const SERVICES_LOAD_FAILED = "Не получилось загрузить услуги.";
export const SERVICES_OFFLINE = "Услуги появятся, когда будет интернет.";
export const SERVICES_EMPTY = "Услуг пока нет. Без них клиенты не смогут записаться.";

const priceFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

export function fetchServices(api: Api): Promise<Service[]> {
  return unwrap(api.GET("/services"));
}

export function formatDuration(min: number): string {
  return `${min}${NBSP}мин`;
}

export function formatPrice(price: number): string {
  return `${priceFormat.format(price)}${NBSP}₸`;
}

export function formatAmount(price: number): string {
  return priceFormat.format(price);
}

export function offeredText(active: boolean): string {
  return active ? OFFERED_YES : OFFERED_NO;
}
