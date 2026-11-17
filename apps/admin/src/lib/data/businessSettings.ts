import type { components } from "@massage-desk/api-types";

import type { createApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { plural } from "@/lib/format";

type Api = ReturnType<typeof createApi>;

export type Settings = components["schemas"]["SettingsResponse"];
export type SettingsUpdate = components["schemas"]["UpdateSettingsRequest"];
export type BusinessDraft = { address: string; timeZone: string };
export type ZoneOption = { id: string; label: string; offset: string | null };
export type SettingsSaveErrorKind = "offline" | "conflict" | "unknownZone" | "invalid" | "failed";

export const ADDRESS_MAX = 300;

export const TIME_ZONES: readonly { id: string; label: string }[] = [
  { id: "Asia/Almaty", label: "Алматы, Астана" },
  { id: "Asia/Tashkent", label: "Ташкент" },
  { id: "Asia/Bishkek", label: "Бишкек" },
  { id: "Europe/Moscow", label: "Москва" },
];

export const BUSINESS_TITLE = "Адрес и часовой пояс";
export const SETTINGS_TABS_LABEL = "Разделы настроек";
export const ADDRESS_LABEL = "Адрес";
export const ZONE_LEGEND = "Часовой пояс";
export const ZONE_HINT = "Все время в приложении и в сообщениях бота показывается в этом поясе.";
export const HOURS_HINT = "Часы работы — в разделе «Расписание».";
export const SAVE_SETTINGS_LABEL = "Сохранить";
export const SAVED_SETTINGS = "Настройки сохранены.";
export const SETTINGS_LOAD_FAILED = "Не получилось загрузить настройки.";
export const SETTINGS_OFFLINE = "Настройки появятся, когда будет интернет.";
export const ZONE_CONFIRM_TITLE = "Сменить часовой пояс?";
export const ZONE_CONFIRM_LABEL = "Да, сменить";
export const ZONE_CANCEL_LABEL = "Отмена";
export const ZONE_CONFLICT_LIST_LABEL = "Записи вне часов работы в новом поясе";

/** The offset as "UTC+5" on the given date, or null for an unknown zone. */
export function zoneOffset(id: string, now: Date): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: id, timeZoneName: "shortOffset" }).formatToParts(now);
    const name = parts.find((p) => p.type === "timeZoneName")?.value;
    return name === undefined ? null : name.replace(/^GMT[+-]0$/, "GMT").replace("GMT", "UTC");
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}

/** The listed zones; the current one is added last when it is not among them. */
export function zoneOptions(current: string, now = new Date()): ZoneOption[] {
  const known = TIME_ZONES.map((z) => ({ ...z, offset: zoneOffset(z.id, now) }));
  if (TIME_ZONES.some((z) => z.id === current)) return known;
  return [...known, { id: current, label: current, offset: zoneOffset(current, now) }];
}

export function zoneName(option: ZoneOption): string {
  return option.offset === null ? option.label : `${option.label} (${option.offset})`;
}

export function businessDraft(settings: Settings): BusinessDraft {
  return { address: settings.address ?? "", timeZone: settings.timeZone };
}

function addressChanged(settings: Settings, draft: BusinessDraft): boolean {
  return draft.address.trim() !== (settings.address ?? "");
}

export function zoneChanged(settings: Settings, draft: BusinessDraft): boolean {
  return draft.timeZone !== settings.timeZone;
}

export function isDirty(settings: Settings, draft: BusinessDraft): boolean {
  return addressChanged(settings, draft) || zoneChanged(settings, draft);
}

/** Only the changed fields; never `botEnabled`. */
export function settingsBody(settings: Settings, draft: BusinessDraft, force: boolean): SettingsUpdate {
  return {
    ...(addressChanged(settings, draft) && { address: draft.address.trim() }),
    ...(zoneChanged(settings, draft) && { timeZone: draft.timeZone }),
    ...(force && { force: true }),
  };
}

export function saveSettings(api: Api, body: SettingsUpdate): Promise<Settings> {
  return unwrap(api.PATCH("/settings", { body }));
}

export function settingsSaveErrorKind(error: unknown): SettingsSaveErrorKind {
  if (!(error instanceof ApiError)) return "failed";
  if (error.kind === "network") return "offline";
  if (error.code === "APPOINTMENT_CONFLICT" && (error.conflicts?.length ?? 0) > 0) return "conflict";
  if (error.code === "UNKNOWN_TIME_ZONE") return "unknownZone";
  if (error.code === "INVALID_REQUEST") return "invalid";
  return "failed";
}

const STATIC_SAVE_ERRORS: Record<Exclude<SettingsSaveErrorKind, "conflict" | "failed">, string> = {
  offline: "Нет связи с сервером. Настройки не сохранены — нажмите «Сохранить», когда интернет вернётся.",
  unknownZone: "Сервер не принял этот часовой пояс. Выберите другой из списка.",
  invalid: "Сервер не принял настройки. Адрес — не длиннее 300 знаков.",
};

export function settingsSaveErrorText(kind: Exclude<SettingsSaveErrorKind, "conflict">, error: unknown): string {
  if (kind !== "failed") return STATIC_SAVE_ERRORS[kind];
  if (error instanceof ApiError && error.status !== undefined) {
    return `Сервер ответил с ошибкой. Код: ${error.status}. Настройки не сохранены.`;
  }
  return "Настройки не сохранены. Попробуйте ещё раз через минуту.";
}

export function zoneConfirmText(name: string): string {
  return `Всё время в приложении и в сообщениях бота будет показываться по поясу «${name}». Записи не переносятся, но их время на экране изменится.`;
}

export function zoneConflictText(n: number): string {
  const singular = plural(n, "запись", "записи", "записей") === "запись";
  const subject = singular ? "запись окажется" : `${plural(n, "запись", "записи", "записей")} окажутся`;
  const remain = singular
    ? "Запись останется — её нужно перенести или отменить самим."
    : "Записи останутся — их нужно перенести или отменить самим.";
  return `${n} ${subject} вне часов работы в новом поясе. ${remain}`;
}
