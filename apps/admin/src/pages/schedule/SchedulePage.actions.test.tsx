// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import type { AppointmentAction } from "@/lib/data/appointmentActions";
import { useScheduleRange } from "@/lib/data/hooks";
import type { Appointment } from "@/lib/data/schedule";

import { SchedulePage } from "./SchedulePage";

const act = vi.hoisted(() =>
  vi.fn<(vars: { id: string; action: AppointmentAction }) => Promise<unknown>>(),
);

vi.mock("@/lib/data/hooks", () => ({
  useTimeZone: () => "Asia/Tashkent",
  useScheduleRange: vi.fn(),
  useAppointmentAction: () =>
    useMutation({
      networkMode: "always",
      mutationFn: (vars: { id: string; action: AppointmentAction }) => act(vars),
    }),
}));

type RangeResult = ReturnType<typeof useScheduleRange>;

const mockedRange = vi.mocked(useScheduleRange);

const STARTED: Appointment = {
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

const FUTURE: Appointment = {
  ...STARTED,
  id: "a2",
  clientName: "Марат Каримов",
  start: new Date("2026-11-04T10:00:00+05:00"),
  end: new Date("2026-11-04T11:00:00+05:00"),
};

function rangeResult(appointments: Appointment[]): RangeResult {
  return {
    timeZone: "Asia/Tashkent",
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
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SchedulePage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-03T05:00:00Z"));
  act.mockReset();
  mockedRange.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("SchedulePage appointment actions", () => {
  it("shows only no-show for started confirmed, only cancel for future confirmed, and none for finished statuses", () => {
    const cancelled: Appointment = {
      ...STARTED,
      id: "a3",
      clientName: "Олег Ким",
      start: new Date("2026-11-06T10:00:00+05:00"),
      end: new Date("2026-11-06T11:00:00+05:00"),
      status: "cancelled",
    };
    const noShow: Appointment = {
      ...FUTURE,
      id: "a4",
      clientName: "Ержан Бекенов",
      start: new Date("2026-11-05T10:00:00+05:00"),
      end: new Date("2026-11-05T11:00:00+05:00"),
      status: "no_show",
    };
    mockedRange.mockReturnValue(rangeResult([STARTED, FUTURE, cancelled, noShow]));
    renderPage();

    const panel = screen.getByRole("complementary", { name: "Выбранная запись" });

    fireEvent.click(screen.getByRole("button", { name: /Айгуль Сапарова/ }));
    expect(within(panel).getByRole("button", { name: "Не пришёл" })).toBeTruthy();
    expect(within(panel).queryByRole("button", { name: "Отменить" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Марат Каримов/ }));
    expect(within(panel).getByRole("button", { name: "Отменить" })).toBeTruthy();
    expect(within(panel).queryByRole("button", { name: "Не пришёл" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Олег Ким/ }));
    expect(within(panel).queryByRole("button", { name: "Отменить" })).toBeNull();
    expect(within(panel).queryByRole("button", { name: "Не пришёл" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Ержан Бекенов/ }));
    expect(within(panel).queryByRole("button", { name: "Отменить" })).toBeNull();
    expect(within(panel).queryByRole("button", { name: "Не пришёл" })).toBeNull();
  });

  it("disables action buttons when offline", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    mockedRange.mockReturnValue(rangeResult([STARTED, FUTURE]));
    renderPage();

    const panel = screen.getByRole("complementary", { name: "Выбранная запись" });

    fireEvent.click(screen.getByRole("button", { name: /Айгуль Сапарова/ }));
    expect(within(panel).getByRole<HTMLButtonElement>("button", { name: "Не пришёл" }).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Марат Каримов/ }));
    expect(within(panel).getByRole<HTMLButtonElement>("button", { name: "Отменить" }).disabled).toBe(true);
  });

  it("returns focus to the panel button when cancelling the confirm dialog or pressing Escape", async () => {
    mockedRange.mockReturnValue(rangeResult([FUTURE]));
    renderPage();

    const panel = screen.getByRole("complementary", { name: "Выбранная запись" });
    fireEvent.click(screen.getByRole("button", { name: /Марат Каримов/ }));
    const cancelBtn = within(panel).getByRole("button", { name: "Отменить" });
    fireEvent.click(cancelBtn);

    expect(screen.getByRole("dialog", { name: "Отменить запись?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Не отменять" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(cancelBtn);
    });

    cancelBtn.blur();
    fireEvent.click(cancelBtn);
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Отменить запись?" }), { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(cancelBtn);
    });
    expect(act).not.toHaveBeenCalled();
  });

  it("cancels appointment, updates panel status without buttons, and moves focus to client name", async () => {
    const futureAigul: Appointment = {
      ...STARTED,
      start: new Date("2026-11-04T10:00:00+05:00"),
      end: new Date("2026-11-04T11:00:00+05:00"),
    };
    let resolve!: (value: unknown) => void;
    act.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    mockedRange.mockReturnValue(rangeResult([futureAigul]));
    renderPage();

    const panel = screen.getByRole("complementary", { name: "Выбранная запись" });
    fireEvent.click(screen.getByRole("button", { name: /Айгуль Сапарова/ }));
    fireEvent.click(within(panel).getByRole("button", { name: "Отменить" }));
    fireEvent.click(screen.getByRole("button", { name: "Отменить запись" }));

    await waitFor(() => {
      expect(act).toHaveBeenCalledWith({ id: "a1", action: "cancel" });
    });

    mockedRange.mockReturnValue(rangeResult([{ ...futureAigul, status: "cancelled" }]));
    resolve({});

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(panel.textContent).toContain("Отменена");
      expect(within(panel).queryByRole("button", { name: "Отменить" })).toBeNull();
      expect(within(panel).queryByRole("button", { name: "Не пришёл" })).toBeNull();
      expect(document.activeElement?.textContent).toBe("Айгуль Сапарова");
    });
  });

  it("keeps dialog open with NOT_STARTED error alert on no-show failure", async () => {
    act.mockRejectedValue(new ApiError("problem", { status: 409, code: "NOT_STARTED" }));
    mockedRange.mockReturnValue(rangeResult([STARTED]));
    renderPage();

    const panel = screen.getByRole("complementary", { name: "Выбранная запись" });
    fireEvent.click(screen.getByRole("button", { name: /Айгуль Сапарова/ }));
    fireEvent.click(within(panel).getByRole("button", { name: "Не пришёл" }));
    expect(screen.getByRole("dialog", { name: "Клиент не пришёл?" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Да, не пришёл" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Запись ещё не началась. Отметить «не пришёл» можно после её начала.");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("shows Cancel button and opens dialog in day view", () => {
    const laterToday: Appointment = {
      ...STARTED,
      start: new Date("2026-11-03T12:00:00+05:00"),
      end: new Date("2026-11-03T13:00:00+05:00"),
    };
    mockedRange.mockReturnValue(rangeResult([laterToday]));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "День" }));
    fireEvent.click(screen.getByRole("button", { name: /Айгуль Сапарова/ }));

    const panel = screen.getByRole("complementary", { name: "Выбранная запись" });
    fireEvent.click(within(panel).getByRole("button", { name: "Отменить" }));
    expect(screen.getByRole("dialog", { name: "Отменить запись?" })).toBeTruthy();
  });
});
