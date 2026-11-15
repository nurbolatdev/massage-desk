// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import { type SlotsResponse, daySlotsOptions } from "@/lib/data/rescheduleTime";
import type { Appointment } from "@/lib/data/schedule";

import { RescheduleTimeDialog } from "./RescheduleTimeDialog";

const slots = vi.hoisted(() =>
  vi.fn<(serviceId: string, day: string) => Promise<SlotsResponse>>(),
);

vi.mock("@/lib/data/hooks", () => ({
  useDaySlots: (serviceId: string, day: string | null) =>
    useQuery(daySlotsOptions(serviceId, day, slots)),
}));

const TZ = "Asia/Tashkent";
const TODAY = "2026-11-02";

const AIGUL: Appointment = {
  id: "a1",
  clientId: "c1",
  clientName: "Айгуль Сапарова",
  clientPhone: "+77010000000",
  serviceId: "s1",
  serviceName: "Массаж спины",
  start: new Date("2026-11-02T05:00:00Z"),
  end: new Date("2026-11-02T06:00:00Z"),
  status: "confirmed",
  source: "bot",
};

function response(day: string, starts: string[]): SlotsResponse {
  return { day, durationMin: 60, starts, timeZone: TZ };
}

function renderDialog(overrides?: {
  appointment?: Appointment;
  day?: string;
  onClose?: () => void;
  onPick?: (start: Date, day: string) => void;
}) {
  const onClose = overrides?.onClose ?? vi.fn();
  const onPick = overrides?.onPick ?? vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <RescheduleTimeDialog
        appointment={overrides?.appointment ?? AIGUL}
        timeZone={TZ}
        today={TODAY}
        day={overrides?.day}
        onClose={onClose}
        onPick={onPick}
      />
    </QueryClientProvider>,
  );
  return { onClose, onPick };
}

beforeEach(() => {
  slots.mockReset();
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("RescheduleTimeDialog", () => {
  it("opens on Today, loads slots, and renders free time chips", async () => {
    slots.mockResolvedValue(
      response("2026-11-02", ["2026-11-02T06:00:00Z", "2026-11-02T10:30:00Z"]),
    );
    renderDialog();

    const dialog = screen.getByRole("dialog", { name: "Перенос записи" });
    expect(dialog.textContent).toContain("Айгуль Сапарова, сейчас пн 2");
    expect(dialog.textContent).toContain("нояб., 10:00. Выберите новый день и время.");
    expect(screen.getByRole("button", { name: "Сегодня" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(slots).toHaveBeenCalledWith("s1", "2026-11-02");

    const group = await screen.findByRole("group", { name: "Свободное время" });
    const chips = within(group).getAllByRole("button");
    expect(chips.map((b) => b.textContent)).toEqual(["11:00", "15:30"]);
  });

  it("switches days and validates date input", async () => {
    slots.mockImplementation(async (_serviceId, day) => response(day, []));
    renderDialog();
    await waitFor(() => expect(slots).toHaveBeenCalledWith("s1", "2026-11-02"));

    fireEvent.click(screen.getByRole("button", { name: "Завтра" }));
    await waitFor(() => expect(slots).toHaveBeenCalledWith("s1", "2026-11-03"));

    fireEvent.click(screen.getByRole("button", { name: "Другое число" }));
    const input = screen.getByLabelText<HTMLInputElement>("Дата");
    fireEvent.change(input, { target: { value: "2026-11-10" } });
    await waitFor(() => expect(slots).toHaveBeenCalledWith("s1", "2026-11-10"));

    const callsBeforeInvalid = slots.mock.calls.length;
    fireEvent.change(input, { target: { value: "2026-11-01" } });
    expect(screen.getByText("Выберите день не раньше сегодняшнего.")).toBeTruthy();
    expect(slots).toHaveBeenCalledTimes(callsBeforeInvalid);
  });

  it("picks initial day from appointment date or passed day prop", async () => {
    slots.mockImplementation(async (_serviceId, day) => response(day, []));
    const future: Appointment = {
      ...AIGUL,
      start: new Date("2026-11-10T05:00:00Z"),
      end: new Date("2026-11-10T06:00:00Z"),
    };
    renderDialog({ appointment: future });
    expect(screen.getByRole("button", { name: "Другое число" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByLabelText<HTMLInputElement>("Дата").value).toBe("2026-11-10");
    await waitFor(() => expect(slots).toHaveBeenCalledWith("s1", "2026-11-10"));

    cleanup();
    slots.mockClear();
    renderDialog({ day: "2026-11-03" });
    expect(screen.getByRole("button", { name: "Завтра" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    await waitFor(() => expect(slots).toHaveBeenCalledWith("s1", "2026-11-03"));
  });

  it("shows loading status and empty day message", async () => {
    let resolve!: (res: SlotsResponse) => void;
    slots.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    renderDialog();
    expect(screen.getByRole("status").textContent).toBe("Загружаем свободное время…");

    resolve(response("2026-11-02", []));
    expect(
      await screen.findByText("В этот день нет свободного времени. Выберите другой день."),
    ).toBeTruthy();
  });

  it("shows network error with retry and hidden service error without retry", async () => {
    slots.mockRejectedValue(new ApiError("network"));
    renderDialog();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Не получилось загрузить свободное время.");
    expect(slots).toHaveBeenCalledTimes(4);

    slots.mockResolvedValueOnce(response("2026-11-02", ["2026-11-02T06:00:00Z"]));
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    await waitFor(() => expect(slots).toHaveBeenCalledTimes(5));
    expect(await screen.findByRole("button", { name: "11:00" })).toBeTruthy();

    cleanup();
    slots.mockReset();
    slots.mockRejectedValue(new ApiError("problem", { status: 404, code: "SERVICE_NOT_FOUND" }));
    renderDialog();

    const hiddenAlert = await screen.findByRole("alert");
    expect(hiddenAlert.textContent).toContain(
      "Эта услуга скрыта, поэтому свободное время не считается. Перенесите запись перетаскиванием в календаре.",
    );
    expect(screen.queryByRole("button", { name: "Повторить" })).toBeNull();
    expect(slots).toHaveBeenCalledTimes(1);
  });

  it("does not retry on 400 error and keeps retry button", async () => {
    slots.mockRejectedValue(new ApiError("problem", { status: 400 }));
    renderDialog();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Не получилось загрузить свободное время.");
    expect(screen.getByRole("button", { name: "Повторить" })).toBeTruthy();
    expect(slots).toHaveBeenCalledTimes(1);
  });

  it("shows offline message without time chips when offline", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    slots.mockResolvedValue(response("2026-11-02", ["2026-11-02T06:00:00Z"]));
    renderDialog();

    expect(
      screen.getByText("Нет связи с сервером. Свободное время появится, когда интернет вернётся."),
    ).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Свободное время" })).toBeNull();
  });

  it("calls onPick on chip click and onClose on cancel or close button", async () => {
    slots.mockResolvedValue(
      response("2026-11-02", ["2026-11-02T06:00:00Z", "2026-11-02T10:30:00Z"]),
    );
    const { onPick } = renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: "15:30" }));
    expect(onPick).toHaveBeenCalledWith(new Date("2026-11-02T10:30:00Z"), "2026-11-02");

    const cancelClose = vi.fn();
    const cancelPick = vi.fn();
    cleanup();
    renderDialog({ onClose: cancelClose, onPick: cancelPick });
    fireEvent.click(screen.getByRole("button", { name: "Не переносить" }));
    expect(cancelClose).toHaveBeenCalledTimes(1);
    expect(cancelPick).not.toHaveBeenCalled();

    const xClose = vi.fn();
    const xPick = vi.fn();
    cleanup();
    renderDialog({ onClose: xClose, onPick: xPick });
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(xClose).toHaveBeenCalledTimes(1);
    expect(xPick).not.toHaveBeenCalled();
  });

  it("restores focus to trigger on cancel and skips trigger focus when picking a time", async () => {
    slots.mockResolvedValue(response("2026-11-02", ["2026-11-02T10:30:00Z"]));

    function Harness() {
      const [open, setOpen] = useState(false);
      const triggerRef = useRef<HTMLButtonElement>(null);
      return (
        <div>
          <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
            Перенести
          </button>
          {open && (
            <RescheduleTimeDialog
              appointment={AIGUL}
              timeZone={TZ}
              today={TODAY}
              trigger={triggerRef.current}
              onClose={() => setOpen(false)}
              onPick={() => setOpen(false)}
            />
          )}
        </div>
      );
    }

    const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
    render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Перенести" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Не переносить" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });

    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("button", { name: "15:30" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(document.activeElement).not.toBe(trigger);
  });
});
