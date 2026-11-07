import type { ClientResponse } from "./booking";

export { INVALID_PHONE_TEXT } from "./bookingForm";

export const PHONE_STEP = "1. Телефон клиента";
export const NEW_CLIENT_LINK = "+ Это новый клиент";
export const NAME_LABEL = "Имя клиента";
export const NEW_CLIENT_INFO_BEFORE = "Такого номера ещё нет — это ";
export const NEW_CLIENT_INFO_BOLD = "новый клиент";
export const NEW_CLIENT_INFO_AFTER = ". Напишите, как его зовут.";
export const SEARCHING_LABEL = "Ищем клиента";
export const SEARCH_EMPTY = "Никого не нашли. Проверьте номер или добавьте нового клиента.";
export const SEARCH_FAILED = "Не получилось найти клиентов.";
export const SEARCH_OFFLINE = "Найти клиента можно, когда есть интернет.";
export const PICK_CLIENT_HINT = "Выбрать клиента";

const MIN_DIGITS = 3;
const MIN_LETTERS = 2;

/** The trimmed text when it is worth a request (3+ digits or 2+ letters), else null. */
export function searchQuery(text: string): string | null {
  const trimmed = text.trim();
  const digits = (trimmed.match(/\d/gu) ?? []).length;
  const letters = (trimmed.match(/\p{L}/gu) ?? []).length;
  return digits >= MIN_DIGITS || letters >= MIN_LETTERS ? trimmed : null;
}

export function exactMatch(
  results: ClientResponse[],
  phone: string | null,
): ClientResponse | undefined {
  if (phone === null) return undefined;
  return results.find((client) => client.phone === phone);
}

export type PickerKind =
  | "idle"
  | "searching"
  | "results"
  | "selected"
  | "noMatch"
  | "newClient"
  | "error"
  | "offline";

export type PickerView = { kind: PickerKind; showNewLink: boolean; showNewInfo: boolean };

export type PickerInput = {
  query: string | null;
  online: boolean;
  results: ClientResponse[];
  loading: boolean;
  failed: boolean;
  selectedId: string | null;
  newClient: boolean;
  /** Normalised E.164 phone of the typed text, or null when it is not a valid number. */
  phone: string | null;
};

export function pickerView(input: PickerInput): PickerView {
  const { query, online, results, loading, failed, selectedId, newClient, phone } = input;
  const matched = exactMatch(results, phone) !== undefined;
  const newInfo = phone !== null && !matched;

  if (selectedId !== null) return { kind: "selected", showNewLink: false, showNewInfo: false };
  // An existing client wins over the new client choice: fall through to the results.
  if (newClient && !matched) {
    const checked = query !== null && online && !loading && !failed;
    return { kind: "newClient", showNewLink: false, showNewInfo: checked && newInfo };
  }
  if (query === null) return { kind: "idle", showNewLink: true, showNewInfo: false };
  if (results.length > 0) return { kind: "results", showNewLink: !matched, showNewInfo: false };
  if (!online) return { kind: "offline", showNewLink: true, showNewInfo: false };
  if (loading) return { kind: "searching", showNewLink: false, showNewInfo: false };
  if (failed) return { kind: "error", showNewLink: true, showNewInfo: false };
  if (phone !== null) return { kind: "newClient", showNewLink: false, showNewInfo: true };
  return { kind: "noMatch", showNewLink: true, showNewInfo: false };
}

export type ClientStatus = "none" | "invalidPhone" | "needsName" | "ready";

export function clientStatus(input: {
  kind: PickerKind;
  phone: string | null;
  name: string;
  selectedId: string | null;
}): ClientStatus {
  if (input.selectedId !== null) return "ready";
  if (input.kind !== "newClient") return "none";
  if (input.phone === null) return "invalidPhone";
  return input.name.trim() === "" ? "needsName" : "ready";
}
