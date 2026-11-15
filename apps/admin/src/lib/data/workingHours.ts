import type { createApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/client";
import { ApiError, type AppointmentConflict } from "@/lib/api/errors";
import { plural } from "@/lib/format";

import { WEEKDAYS_LONG } from "./calendar";
import { slotLines } from "./reschedule";
import type { WorkingBlock, WorkingHours } from "./schedule";

export type HoursRange = { start: string; end: string };
export type WeekDraft = HoursRange[][];
export type DayProblem = "empty" | "order" | "overlap";

// same as the API
export const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
export const MAX_RANGES_PER_DAY = 4;
export const DEFAULT_RANGE: HoursRange = { start: "09:00", end: "18:00" };

export const HOURS_TITLE = "Часы работы";
export const HOURS_INTRO =
  "Бот предлагает клиентам только это время. Чтобы сделать перерыв, нажмите «Добавить время» и разделите день на две части.";
export const DAY_OFF_LABEL = "Выходной";
export const ADD_RANGE_LABEL = "Добавить время";
export const SAVE_LABEL = "Сохранить";
export const SAVED_TEXT = "Часы сохранены. Бот уже предлагает клиентам новое время.";
export const SAVE_OFFLINE_HINT = "Сохранить можно, когда появится связь с сервером.";
export const HOURS_LOAD_FAILED = "Не удалось загрузить часы работы";

export const DAY_PROBLEM_TEXT: Record<DayProblem, string> = {
  empty: "Укажите начало и конец.",
  order: "Конец должен быть позже начала.",
  overlap: "Часы этого дня пересекаются или идут подряд. Объедините их или оставьте перерыв.",
};

const MAX_MINUTE = 23 * 60 + 59;

function compareRanges(a: HoursRange, b: HoursRange): number {
  if (a.start !== b.start) return a.start < b.start ? -1 : 1;
  return a.end === b.end ? 0 : a.end < b.end ? -1 : 1;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
}

function fromMinutes(total: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

function replaceDay(draft: WeekDraft, day: number, update: (ranges: HoursRange[]) => HoursRange[]): WeekDraft {
  return draft.map((ranges, i) => (i === day ? update(ranges) : ranges));
}

/** Converts API working blocks into a 7-day draft (index 0 = Monday), sorted by start time. */
export function toDraft(blocks: readonly WorkingBlock[]): WeekDraft {
  const draft: WeekDraft = Array.from({ length: 7 }, () => []);
  for (const block of blocks) {
    if (!Number.isInteger(block.weekday)) continue;
    draft[block.weekday - 1]?.push({ start: block.start, end: block.end });
  }
  return draft.map((ranges) => [...ranges].sort(compareRanges));
}

/** Converts a 7-day draft into API working blocks, ordered by weekday and start time. */
export function toBlocks(draft: WeekDraft): WorkingBlock[] {
  return draft.flatMap((ranges, index) =>
    [...ranges].sort(compareRanges).map((r) => ({ weekday: index + 1, start: r.start, end: r.end })),
  );
}

/** Whether the draft matches the normalized API blocks element by element. */
export function sameWeek(draft: WeekDraft, blocks: readonly WorkingBlock[]): boolean {
  const a = toBlocks(draft);
  const b = toBlocks(toDraft(blocks));
  return a.length === b.length && a.every((x, i) => x.weekday === b[i]?.weekday && x.start === b[i]?.start && x.end === b[i]?.end);
}

/** First validation problem for a single day, or `null` if valid. */
export function dayProblem(ranges: readonly HoursRange[]): DayProblem | null {
  if (ranges.some((r) => !TIME_PATTERN.test(r.start) || !TIME_PATTERN.test(r.end))) return "empty";
  if (ranges.some((r) => r.end <= r.start)) return "order";
  const sorted = [...ranges].sort(compareRanges);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev && curr && curr.start <= prev.end) return "overlap";
  }
  return null;
}

export function weekProblems(draft: WeekDraft): (DayProblem | null)[] {
  return draft.map(dayProblem);
}

export function canSave(draft: WeekDraft): boolean {
  return draft.every((ranges) => dayProblem(ranges) === null);
}

export function canAddRange(ranges: readonly HoursRange[]): boolean {
  return ranges.length < MAX_RANGES_PER_DAY;
}

/** Suggests a new 1-hour range 1 hour after the latest valid end, or empty fields if it does not fit. */
export function nextRange(ranges: readonly HoursRange[]): HoursRange {
  if (ranges.length === 0) return { ...DEFAULT_RANGE };
  const validEnds = ranges.filter((r) => TIME_PATTERN.test(r.end)).map((r) => toMinutes(r.end));
  if (validEnds.length === 0) return { start: "", end: "" };
  const startMin = Math.max(...validEnds) + 60;
  const endMin = startMin + 60;
  return endMin > MAX_MINUTE ? { start: "", end: "" } : { start: fromMinutes(startMin), end: fromMinutes(endMin) };
}

export function setRange(draft: WeekDraft, day: number, index: number, patch: Partial<HoursRange>): WeekDraft {
  return replaceDay(draft, day, (ranges) => ranges.map((r, i) => (i === index ? { ...r, ...patch } : r)));
}

export function addRange(draft: WeekDraft, day: number): WeekDraft {
  const target = draft[day];
  if (!target || !canAddRange(target)) return draft;
  return replaceDay(draft, day, (ranges) => [...ranges, nextRange(ranges)]);
}

export function removeRange(draft: WeekDraft, day: number, index: number): WeekDraft {
  return replaceDay(draft, day, (ranges) => ranges.filter((_, i) => i !== index));
}

export function setDayOff(draft: WeekDraft, day: number, off: boolean): WeekDraft {
  return replaceDay(draft, day, () => (off ? [] : [{ ...DEFAULT_RANGE }]));
}

export function rangeFieldLabel(day: number, index: number, edge: "start" | "end"): string {
  return `${WEEKDAYS_LONG[day] ?? ""}, время ${index + 1}: ${edge === "start" ? "начало" : "конец"}`;
}

export function removeRangeLabel(day: number, index: number): string {
  return `Удалить: ${WEEKDAYS_LONG[day] ?? ""}, время ${index + 1}`;
}

export const CONFLICT_TITLE = "Сохранить новые часы?";
export const CONFLICT_CONFIRM = "Да, сохранить";
export const CONFLICT_BACK = "Изменить часы";
export const CONFLICT_LIST_MAX = 5;

export type SaveErrorKind = "conflict" | "invalid" | "offline" | "failed";
export type ConflictLine = { id: string; name: string; when: string };

export function saveWorkingHours(
  api: ReturnType<typeof createApi>,
  blocks: WorkingBlock[],
  force: boolean,
): Promise<WorkingHours> {
  return unwrap(api.PUT("/working-hours", { body: { blocks, force } }));
}

export function saveErrorKind(error: unknown): SaveErrorKind {
  if (!(error instanceof ApiError)) return "failed";
  if (error.kind === "network") return "offline";
  if (error.code === "APPOINTMENT_CONFLICT" && (error.conflicts?.length ?? 0) > 0) return "conflict";
  if (error.code === "INVALID_HOURS" || error.code === "INVALID_REQUEST") return "invalid";
  return "failed";
}

const STATIC_SAVE_ERRORS: Record<Exclude<SaveErrorKind, "conflict" | "failed">, string> = {
  invalid: "Эти часы сохранить нельзя. Проверьте, что конец позже начала и часы одного дня не пересекаются.",
  offline: "Нет связи с сервером. Часы не сохранены — нажмите «Сохранить», когда интернет вернётся.",
};

export function saveErrorText(kind: Exclude<SaveErrorKind, "conflict">, error: unknown): string {
  if (kind !== "failed") return STATIC_SAVE_ERRORS[kind];
  if (error instanceof ApiError && error.status !== undefined) {
    return `Сервер ответил с ошибкой. Код: ${error.status}. Часы не сохранены.`;
  }
  return "Часы не сохранены. Попробуйте ещё раз через минуту.";
}

export function conflictText(n: number): string {
  const noun = plural(n, "запись", "записи", "записей");
  const verb = noun === "запись" ? "попадает" : "попадают";
  return `${n} ${noun} не ${verb} в новые часы. Записи останутся — их нужно перенести или отменить самим. Новых записей в это время не будет.`;
}

export function conflictLines(conflicts: readonly AppointmentConflict[], timeZone: string): ConflictLine[] {
  return [...conflicts]
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .map((c) => {
      const { day, time } = slotLines(new Date(c.start), new Date(c.end), timeZone);
      return {
        id: c.appointmentId,
        name: c.clientName ?? "Клиент без имени",
        when: `${day}, ${time}`,
      };
    });
}

export function conflictMore(rest: number): string | null {
  if (rest <= 0) return null;
  return `И ещё ${rest} ${plural(rest, "запись", "записи", "записей")}.`;
}
