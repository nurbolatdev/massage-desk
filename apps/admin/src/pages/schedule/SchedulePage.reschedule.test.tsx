// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import type { Appointment } from "@/lib/data/schedule";

import { SchedulePage } from "./SchedulePage";

const THU_START = new Date("2026-11-05T11:00:00Z");

const MARAT: Appointment = {
  id: "a1",
  clientId: "c1",
  clientName: "Марат Каримов",
  clientPhone: "+77010000000",
  serviceId: "s1",
  serviceName: "Общий",
  start: new Date("2026-11-02T11:00:00Z"),
  end: new Date("2026-11-02T12:00:00Z"),
  status: "confirmed",
  source: "manual",
};

const { reschedule, latest } = vi.hoisted(() => ({
  reschedule: vi.fn<(vars: { id: string; start: Date }) => Promise<unknown>>(),
  latest: { appointments: [] as Appointment[] },
}));

vi.mock("@/lib/data/hooks", () => ({
  useTimeZone: () => "Asia/Tashkent",
  useScheduleRange: () => ({
    timeZone: "Asia/Tashkent",
    appointments: [MARAT],
    timeOff: [],
    workingBlocks: undefined,
    dataUpdatedAt: 0,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useRescheduleAppointment: () =>
    useMutation({
      networkMode: "always",
      mutationFn: (vars: { id: string; start: Date }) => reschedule(vars),
    }),
}));

type WeekGridMockProps = {
  appointments: Appointment[];
  onReschedule?: (appointment: Appointment, start: Date) => void;
};

vi.mock("./WeekGrid", () => ({
  WeekGrid: ({ appointments, onReschedule }: WeekGridMockProps) => {
    latest.appointments = appointments;
    return (
      <button
        type="button"
        onClick={() => {
          const target = appointments[0];
          if (target && onReschedule) onReschedule(target, THU_START);
        }}
      >
        drop
      </button>
    );
  },
}));

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
  vi.setSystemTime(new Date("2026-11-02T04:35:00Z"));
  reschedule.mockReset();
  latest.appointments = [];
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("SchedulePage reschedule", () => {
  it("shows TIME_TAKEN conflict in dialog, keeps appointment in place, and closes on cancel", async () => {
    reschedule.mockRejectedValue(new ApiError("problem", { status: 409, code: "TIME_TAKEN" }));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "drop" }));

    const dialog = screen.getByRole("dialog", { name: "Перенести запись?" });
    expect(dialog.textContent).toContain("пн 2 нояб.");
    expect(dialog.textContent).toContain("чт 5 нояб.");

    fireEvent.click(screen.getByRole("button", { name: "Перенести" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("16:00 уже занято. Выберите другое время.");
    expect(screen.getByRole("dialog", { name: "Перенести запись?" })).toBeTruthy();
    expect(reschedule).toHaveBeenCalledTimes(1);
    expect(reschedule).toHaveBeenCalledWith({ id: "a1", start: THU_START });
    expect(latest.appointments[0]?.start).toEqual(MARAT.start);

    fireEvent.click(screen.getByRole("button", { name: "Вернуть как было" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows OUTSIDE_SCHEDULE conflict and keeps dialog open", async () => {
    reschedule.mockRejectedValue(new ApiError("problem", { status: 422, code: "OUTSIDE_SCHEDULE" }));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "drop" }));
    fireEvent.click(screen.getByRole("button", { name: "Перенести" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Это время уже нельзя записать. Выберите другое время.");
    expect(screen.getByRole("dialog", { name: "Перенести запись?" })).toBeTruthy();
  });

  it("shows APPOINTMENT_NOT_FOUND conflict", async () => {
    reschedule.mockRejectedValue(new ApiError("problem", { status: 404, code: "APPOINTMENT_NOT_FOUND" }));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "drop" }));
    fireEvent.click(screen.getByRole("button", { name: "Перенести" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Запись уже изменилась. Закройте окно — на экране новое состояние.");
  });

  it("closes dialog and selects rescheduled appointment on success", async () => {
    reschedule.mockResolvedValue({});
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "drop" }));
    fireEvent.click(screen.getByRole("button", { name: "Перенести" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    const panel = screen.getByRole("complementary", { name: "Выбранная запись" });
    expect(panel.textContent).toContain("Марат Каримов");
  });

  it("opens dialog without previous error when rescheduling again after an error", async () => {
    reschedule.mockRejectedValueOnce(new ApiError("problem", { status: 409, code: "TIME_TAKEN" }));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "drop" }));
    fireEvent.click(screen.getByRole("button", { name: "Перенести" }));

    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Вернуть как было" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "drop" }));
    expect(screen.getByRole("dialog", { name: "Перенести запись?" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
