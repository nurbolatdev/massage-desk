// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import { useScheduleRange } from "@/lib/data/hooks";
import { type SlotsResponse, daySlotsOptions } from "@/lib/data/rescheduleTime";
import type { Appointment } from "@/lib/data/schedule";

import { SchedulePage } from "./SchedulePage";

const { slots, reschedule } = vi.hoisted(() => ({
  slots: vi.fn<(serviceId: string, day: string) => Promise<SlotsResponse>>(),
  reschedule: vi.fn<(vars: { id: string; start: Date }) => Promise<unknown>>(),
}));

vi.mock("@/lib/data/hooks", () => ({
  useTimeZone: () => "Asia/Tashkent",
  useScheduleRange: vi.fn(),
  useDaySlots: (serviceId: string, day: string | null) =>
    useQuery(daySlotsOptions(serviceId, day, slots)),
  useRescheduleAppointment: () =>
    useMutation({
      networkMode: "always",
      mutationFn: (vars: { id: string; start: Date }) => reschedule(vars),
    }),
}));

type RangeResult = ReturnType<typeof useScheduleRange>;

const mockedRange = vi.mocked(useScheduleRange);

const TZ = "Asia/Tashkent";

const AIGUL: Appointment = {
  id: "a1",
  clientId: "c1",
  clientName: "Айгуль Сапарова",
  clientPhone: "+77012345678",
  serviceId: "s1",
  serviceName: "Спина",
  start: new Date("2026-11-03T10:00:00+05:00"),
  end: new Date("2026-11-03T11:00:00+05:00"),
  status: "confirmed",
  source: "bot",
};

function response(day: string, starts: string[]): SlotsResponse {
  return { day, durationMin: 60, starts, timeZone: TZ };
}

function rangeResult(appointments: Appointment[]): RangeResult {
  return {
    timeZone: TZ,
    appointments,
    timeOff: [],
    workingBlocks: undefined,
    dataUpdatedAt: 0,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SchedulePage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-02T04:35:00Z"));
  slots.mockReset();
  reschedule.mockReset();
  mockedRange.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("SchedulePage panel reschedule", () => {
  it("shows Reschedule first for confirmed, hides for cancelled, and disables when offline", () => {
    const cancelled: Appointment = {
      ...AIGUL,
      id: "a2",
      clientName: "Марат Каримов",
      start: new Date("2026-11-04T10:00:00+05:00"),
      end: new Date("2026-11-04T11:00:00+05:00"),
      status: "cancelled",
    };
    mockedRange.mockReturnValue(rangeResult([AIGUL, cancelled]));
    renderPage();

    const panel = screen.getByRole("complementary", { name: "Выбранная запись" });
    fireEvent.click(screen.getByRole("button", { name: /Айгуль Сапарова/ }));

    const buttons = within(panel).getAllByRole<HTMLButtonElement>("button");
    expect(buttons[0]?.textContent).toBe("Перенести");
    expect(buttons[1]?.textContent).toBe("Отменить");
    expect(buttons[0]?.disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /Марат Каримов/ }));
    expect(within(panel).queryByRole("button", { name: "Перенести" })).toBeNull();

    cleanup();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderPage();
    const offlinePanel = screen.getByRole("complementary", { name: "Выбранная запись" });
    fireEvent.click(screen.getByRole("button", { name: /Айгуль Сапарова/ }));
    expect(
      within(offlinePanel).getByRole<HTMLButtonElement>("button", { name: "Перенести" }).disabled,
    ).toBe(true);
  });

  it("opens picker on Tomorrow, moves to confirmation on time click, and focuses name on success", async () => {
    slots.mockResolvedValue(response("2026-11-03", ["2026-11-03T15:00:00+05:00"]));
    reschedule.mockResolvedValue({});
    mockedRange.mockReturnValue(rangeResult([AIGUL]));
    renderPage();

    const panel = screen.getByRole("complementary", { name: "Выбранная запись" });
    fireEvent.click(screen.getByRole("button", { name: /Айгуль Сапарова/ }));
    fireEvent.click(within(panel).getByRole("button", { name: "Перенести" }));

    const picker = screen.getByRole("dialog", { name: "Перенос записи" });
    expect(within(picker).getByRole("button", { name: "Завтра" }).getAttribute("aria-pressed")).toBe("true");
    expect(slots).toHaveBeenCalledWith("s1", "2026-11-03");

    fireEvent.click(await within(picker).findByRole("button", { name: "15:00" }));

    expect(screen.queryByRole("dialog", { name: "Перенос записи" })).toBeNull();
    const confirm = screen.getByRole("dialog", { name: "Перенести запись?" });
    expect(confirm.textContent).toContain("Вы выбрали новое время для записи: Айгуль Сапарова");
    expect(confirm.textContent).toContain("вт 3 нояб.");
    expect(confirm.textContent).toContain("15:00–16:00");

    fireEvent.click(within(confirm).getByRole("button", { name: "Перенести" }));

    await waitFor(() => {
      expect(reschedule).toHaveBeenCalledWith({
        id: "a1",
        start: new Date("2026-11-03T10:00:00Z"),
      });
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(panel.textContent).toContain("Айгуль Сапарова");
      expect(document.activeElement?.textContent).toBe("Айгуль Сапарова");
    });
  });

  it("handles TIME_TAKEN, returns to the same day on pick again, and handles OUTSIDE_SCHEDULE", async () => {
    slots.mockResolvedValue(response("2026-11-03", ["2026-11-03T15:00:00+05:00"]));
    reschedule
      .mockRejectedValueOnce(new ApiError("problem", { status: 409, code: "TIME_TAKEN" }))
      .mockRejectedValueOnce(new ApiError("problem", { status: 422, code: "OUTSIDE_SCHEDULE" }));
    mockedRange.mockReturnValue(rangeResult([AIGUL]));
    renderPage();

    const panel = screen.getByRole("complementary", { name: "Выбранная запись" });
    fireEvent.click(screen.getByRole("button", { name: /Айгуль Сапарова/ }));
    fireEvent.click(within(panel).getByRole("button", { name: "Перенести" }));

    fireEvent.click(await screen.findByRole("button", { name: "15:00" }));
    const confirm1 = screen.getByRole("dialog", { name: "Перенести запись?" });
    fireEvent.click(within(confirm1).getByRole("button", { name: "Перенести" }));

    const alert1 = await screen.findByRole("alert");
    expect(alert1.textContent).toBe("15:00 уже занято. Выберите другое время.");

    fireEvent.click(within(confirm1).getByRole("button", { name: "Выбрать другое время" }));

    const picker2 = screen.getByRole("dialog", { name: "Перенос записи" });
    expect(within(picker2).getByRole("button", { name: "Завтра" }).getAttribute("aria-pressed")).toBe("true");
    await waitFor(() => {
      expect(slots).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(await within(picker2).findByRole("button", { name: "15:00" }));
    const confirm2 = screen.getByRole("dialog", { name: "Перенести запись?" });
    fireEvent.click(within(confirm2).getByRole("button", { name: "Перенести" }));

    const alert2 = await screen.findByRole("alert");
    expect(alert2.textContent).toBe("Это время уже нельзя записать. Выберите другое время.");
  });

  it("cancels picker without mutating and returns focus to Reschedule button", async () => {
    slots.mockResolvedValue(response("2026-11-03", ["2026-11-03T15:00:00+05:00"]));
    mockedRange.mockReturnValue(rangeResult([AIGUL]));
    renderPage();

    const panel = screen.getByRole("complementary", { name: "Выбранная запись" });
    fireEvent.click(screen.getByRole("button", { name: /Айгуль Сапарова/ }));
    const btn = within(panel).getByRole("button", { name: "Перенести" });
    fireEvent.click(btn);

    expect(screen.getByRole("dialog", { name: "Перенос записи" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Не переносить" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(btn);
    });
    expect(reschedule).not.toHaveBeenCalled();
  });

  it("opens picker from appointment panel in day view", () => {
    slots.mockResolvedValue(response("2026-11-03", []));
    mockedRange.mockReturnValue(rangeResult([AIGUL]));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "День" }));
    fireEvent.click(screen.getByRole("button", { name: "Следующий день" }));
    fireEvent.click(screen.getByRole("button", { name: /Айгуль Сапарова/ }));

    const panel = screen.getByRole("complementary", { name: "Выбранная запись" });
    fireEvent.click(within(panel).getByRole("button", { name: "Перенести" }));
    expect(screen.getByRole("dialog", { name: "Перенос записи" })).toBeTruthy();
  });

  it("moves week anchor to the new week when rescheduled outside the current week", async () => {
    slots.mockImplementation(async (_serviceId, day) =>
      day === "2026-11-10"
        ? response("2026-11-10", ["2026-11-10T11:00:00+05:00"])
        : response(day, []),
    );
    reschedule.mockResolvedValue({});
    mockedRange.mockReturnValue(rangeResult([AIGUL]));
    renderPage();

    const panel = screen.getByRole("complementary", { name: "Выбранная запись" });
    fireEvent.click(screen.getByRole("button", { name: /Айгуль Сапарова/ }));
    fireEvent.click(within(panel).getByRole("button", { name: "Перенести" }));

    const picker = screen.getByRole("dialog", { name: "Перенос записи" });
    fireEvent.click(within(picker).getByRole("button", { name: "Другое число" }));
    fireEvent.change(within(picker).getByLabelText("Дата"), { target: { value: "2026-11-10" } });

    fireEvent.click(await within(picker).findByRole("button", { name: "11:00" }));
    const confirm = screen.getByRole("dialog", { name: "Перенести запись?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Перенести" }));

    await waitFor(() => {
      expect(mockedRange).toHaveBeenLastCalledWith("2026-11-09", "2026-11-15");
    });
  });

  it("after TIME_TAKEN the picker shows loading, not the old times", async () => {
    slots
      .mockResolvedValueOnce(response("2026-11-03", ["2026-11-03T15:00:00+05:00"]))
      .mockImplementation(() => new Promise<SlotsResponse>(() => {}));
    reschedule.mockRejectedValueOnce(new ApiError("problem", { status: 409, code: "TIME_TAKEN" }));
    mockedRange.mockReturnValue(rangeResult([AIGUL]));
    renderPage();

    const panel = screen.getByRole("complementary", { name: "Выбранная запись" });
    fireEvent.click(screen.getByRole("button", { name: /Айгуль Сапарова/ }));
    fireEvent.click(within(panel).getByRole("button", { name: "Перенести" }));

    fireEvent.click(await screen.findByRole("button", { name: "15:00" }));
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    const confirm = screen.getByRole("dialog", { name: "Перенести запись?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Перенести" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("15:00 уже занято. Выберите другое время.");

    fireEvent.click(within(confirm).getByRole("button", { name: "Выбрать другое время" }));

    const picker = screen.getByRole("dialog", { name: "Перенос записи" });
    await waitFor(() => expect(slots).toHaveBeenCalledTimes(2));
    expect(within(picker).getByRole("status").textContent).toBe("Загружаем свободное время…");
    expect(within(picker).queryByRole("button", { name: "15:00" })).toBeNull();
  });
});
