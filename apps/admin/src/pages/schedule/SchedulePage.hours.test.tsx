// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { ApiError } from "@/lib/api/errors";
import { useScheduleRange } from "@/lib/data/hooks";
import { HOURS_TITLE } from "@/lib/data/workingHours";

import { SchedulePage } from "./SchedulePage";

vi.mock("@/lib/data/hooks", () => ({ useTimeZone: () => "Asia/Tashkent", useScheduleRange: vi.fn() }));
vi.mock("./WorkingHoursEditor", () => ({ WorkingHoursEditor: () => <label>Заметка<input /></label> }));

type Result = ReturnType<typeof useScheduleRange>;

const mocked = vi.mocked(useScheduleRange);

function result(over: Partial<Result> = {}): Result {
  return {
    timeZone: "Asia/Tashkent",
    appointments: [],
    timeOff: [],
    workingBlocks: undefined,
    dataUpdatedAt: 0,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    ...over,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-03T05:00:00Z"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("SchedulePage working hours view", () => {
  it("lists all three views in order and mounts the editor lazily", () => {
    mocked.mockReturnValue(result());
    render(<SchedulePage />);
    const buttons = within(screen.getByRole("group", { name: "Вид" })).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Неделя", "День", HOURS_TITLE]);
    expect(screen.queryByLabelText("Заметка")).toBeNull();
  });

  it("opens working hours view without week navigation or calendar", () => {
    mocked.mockReturnValue(result());
    render(<SchedulePage />);
    const hoursButton = screen.getByRole("button", { name: HOURS_TITLE });
    fireEvent.click(hoursButton);

    expect(hoursButton.getAttribute("aria-pressed")).toBe("true");
    const input = screen.getByLabelText("Заметка");
    expect(input.closest("[hidden]")).toBeNull();
    expect(screen.queryByRole("button", { name: "Предыдущая неделя" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Неделя" })).toBeNull();
  });

  it("hides schedule loading and error states while in working hours view", () => {
    mocked.mockReturnValue(result({ appointments: undefined, timeOff: undefined, isLoading: true }));
    const loadingRender = render(<SchedulePage />);
    fireEvent.click(screen.getByRole("button", { name: HOURS_TITLE }));
    expect(loadingRender.container.querySelector('[aria-busy="true"]')).toBeNull();
    loadingRender.unmount();

    mocked.mockReturnValue(result({ appointments: undefined, timeOff: undefined, error: new ApiError("network") }));
    render(<SchedulePage />);
    fireEvent.click(screen.getByRole("button", { name: HOURS_TITLE }));
    expect(screen.queryByText("Не удалось загрузить расписание")).toBeNull();
    expect(screen.getByLabelText("Заметка")).toBeTruthy();
  });

  it("keeps the editor mounted and preserves draft across view switches", () => {
    mocked.mockReturnValue(result());
    render(<SchedulePage />);
    fireEvent.click(screen.getByRole("button", { name: HOURS_TITLE }));

    const input = screen.getByLabelText<HTMLInputElement>("Заметка");
    fireEvent.change(input, { target: { value: "черновик" } });

    fireEvent.click(screen.getByRole("button", { name: "Неделя" }));
    expect(screen.getByRole("region", { name: "Неделя" })).toBeTruthy();
    expect(screen.getByLabelText("Заметка").closest("[hidden]")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: HOURS_TITLE }));
    const restored = screen.getByLabelText<HTMLInputElement>("Заметка");
    expect(restored.closest("[hidden]")).toBeNull();
    expect(restored.value).toBe("черновик");
  });
});
