export const NOTE_TITLE = "Заметка о клиенте";
export const NOTE_EDIT_LABEL = "Изменить";
export const NOTE_ADD_LABEL = "Добавить";
export const NOTE_EMPTY = "Заметки пока нет.";
export const NOTE_LOAD_FAILED = "Не получилось загрузить заметку.";
export const NOTE_OFFLINE = "Заметка появится, когда будет интернет.";
export const NOTE_INLINE_PREFIX = "Заметка:";
export const NOTE_FIELD_LABEL = "Заметка";
export const NOTE_SAVE_LABEL = "Сохранить";
export const NOTE_CLOSE_LABEL = "Отмена";
export const NOTE_SAVE_FAILED =
  "Не получилось сохранить заметку. Проверьте интернет и попробуйте ещё раз.";
export const NOTE_MAX_LENGTH = 2000;

export const NOTE_PHRASES: readonly string[] = [
  "Болит поясница",
  "Болит шея",
  "Слабое давление",
  "Сильное давление",
  "Без масла с запахом",
  "Звонить накануне",
];

export function noteSheetSubtitle(name: string): string {
  return `${name} · видите только вы`;
}

export function hasPhrase(text: string, phrase: string): boolean {
  return text.toLowerCase().includes(phrase.toLowerCase());
}

const SEPARATORS = [". ", ", ", "."];

export function toggleNotePhrase(text: string, phrase: string): string {
  const index = text.toLowerCase().indexOf(phrase.toLowerCase());
  if (index === -1) {
    const base = text.trimEnd();
    if (base === "") return phrase;
    const separator = /[.!?]$/.test(base) ? " " : ". ";
    return `${base}${separator}${phrase}`;
  }
  const before = text.slice(0, index);
  const afterPhrase = text.slice(index + phrase.length);
  const separator = SEPARATORS.find((s) => afterPhrase.startsWith(s)) ?? "";
  return `${before}${afterPhrase.slice(separator.length)}`.trim();
}
