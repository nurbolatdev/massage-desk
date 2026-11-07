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

function splitParts(text: string): { content: string; separator: string }[] {
  const pieces = text.split(/([.,;\n])/);
  const parts: { content: string; separator: string }[] = [];
  for (let i = 0; i < pieces.length; i += 2) {
    parts.push({ content: pieces[i] ?? "", separator: pieces[i + 1] ?? "" });
  }
  return parts;
}

function sameText(part: string, phrase: string): boolean {
  return part.trim().toLowerCase() === phrase.trim().toLowerCase();
}

export function hasPhrase(text: string, phrase: string): boolean {
  return splitParts(text).some((part) => sameText(part.content, phrase));
}

export function toggleNotePhrase(text: string, phrase: string): string {
  const parts = splitParts(text);
  const index = parts.findIndex((part) => sameText(part.content, phrase));
  if (index === -1) {
    const base = text.trimEnd();
    if (base === "") return phrase;
    const separator = /[.!?]$/.test(base) ? " " : ". ";
    return `${base}${separator}${phrase}`;
  }
  const rest = parts
    .filter((_, i) => i !== index)
    .map((part) => `${part.content}${part.separator}`)
    .join("");
  return rest.trim().replace(/[,;]+$/, "");
}
