// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ApiError } from "@/lib/api/errors";
import { useScheduleRange } from "@/lib/data/hooks";
import type { Appointment } from "@/lib/data/schedule";

import { SchedulePage } from "./SchedulePage";

vi.mock("@/lib/data/hooks", () => ({ useTimeZone: () => "Asia/Tashkent", useScheduleRange: vi.fn() }));

type Result = ReturnType<typeof useScheduleRange>;

const refetch = vi.fn();
const mocked = vi.mocked(useScheduleRange);

const appointment: Appointment = {
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

function result(over: Partial<Result> = {}): Result {
  return {
    timeZone: "Asia/Tashkent",
    appointments: [appointment],
    timeOff: [],
    workingBlocks: undefined,
    dataUpdatedAt: 0,
    isLoading: false,
    error: null,
    refetch,
    ...over,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-03T05:00:00Z"));
  refetch.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("SchedulePage", () => {
  it("shows the skeleton while loading", () => {
    mocked.mockReturnValue(result({ appointments: undefined, timeOff: undefined, isLoading: true }));
    const { container } = render(<SchedulePage />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("shows the error with a retry button when there is no data", () => {
    mocked.mockReturnValue(result({ appointments: undefined, timeOff: undefined, error: new ApiError("network") }));
    render(<SchedulePage />);
    expect(screen.getByText("Не удалось загрузить расписание")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("keeps the calendar when the error comes with cached data", () => {
    mocked.mockReturnValue(result({ error: new ApiError("network") }));
    render(<SchedulePage />);
    expect(screen.getByRole("region", { name: "Неделя" })).toBeTruthy();
    expect(screen.queryByText("Не удалось загрузить расписание")).toBeNull();
  });

  it("says so when the week has no appointments", () => {
    mocked.mockReturnValue(result({ appointments: [] }));
    render(<SchedulePage />);
    expect(screen.getByText("На этой неделе записей нет")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Неделя" })).toBeTruthy();
  });

  it("asks for the current week and shows the selected appointment", () => {
    mocked.mockReturnValue(result());
    render(<SchedulePage />);
    expect(mocked).toHaveBeenCalledWith("2026-11-02", "2026-11-08");
    expect(screen.getByText("2 – 8 ноября")).toBeTruthy();
    expect(screen.getByText("Нажмите на запись в календаре — здесь появятся подробности.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Айгуль Сапарова/ }));
    const panel = screen.getByRole("complementary", { name: "Выбранная запись" });
    expect(panel.textContent).toContain("Айгуль Сапарова");
    expect(panel.textContent).toContain("+77012345678");
    expect(panel.textContent).toContain("Подтверждена");
    expect(panel.textContent).toContain("Бот");
  });

  it("moves to the next week and drops the selection", () => {
    mocked.mockReturnValue(result());
    render(<SchedulePage />);
    fireEvent.click(screen.getByRole("button", { name: /Айгуль Сапарова/ }));
    fireEvent.click(screen.getByRole("button", { name: "Следующая неделя" }));
    expect(mocked).toHaveBeenLastCalledWith("2026-11-09", "2026-11-15");
    expect(screen.getByText("Нажмите на запись в календаре — здесь появятся подробности.")).toBeTruthy();
  });
});
