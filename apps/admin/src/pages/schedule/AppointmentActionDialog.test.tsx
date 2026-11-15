// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import type { AppointmentAction } from "@/lib/data/appointmentActions";
import type { Appointment } from "@/lib/data/schedule";

import { AppointmentActionDialog } from "./AppointmentActionDialog";

const act = vi.hoisted(() =>
  vi.fn<(vars: { id: string; action: AppointmentAction }) => Promise<unknown>>(),
);

vi.mock("@/lib/data/hooks", () => ({
  useAppointmentAction: () =>
    useMutation({
      mutationFn: (vars: { id: string; action: AppointmentAction }) => act(vars),
    }),
}));

const TZ = "Asia/Tashkent";

const AIGUL: Appointment = {
  id: "a1",
  clientId: "c1",
  clientName: "Айгуль Сапарова",
  clientPhone: "+77010000000",
  serviceId: "s1",
  serviceName: "Спина",
  start: new Date("2026-11-02T05:00:00Z"),
  end: new Date("2026-11-02T06:00:00Z"),
  status: "confirmed",
  source: "manual",
};

function renderDialog(
  kind: AppointmentAction = "cancel",
  onClose = vi.fn(),
  onDone = vi.fn(),
  returnFocus?: () => HTMLElement | null,
) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AppointmentActionDialog
        appointment={AIGUL}
        kind={kind}
        timeZone={TZ}
        onClose={onClose}
        onDone={onDone}
        returnFocus={returnFocus}
      />
    </QueryClientProvider>,
  );
  return { onClose, onDone };
}

beforeEach(() => {
  act.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("AppointmentActionDialog", () => {
  it("shows cancel copy, focuses the back button and styles the confirm button with danger", () => {
    renderDialog("cancel");
    const dialog = screen.getByRole("dialog", { name: "Отменить запись?" });
    expect(dialog.textContent).toContain("Айгуль Сапарова");
    expect(dialog.textContent).toContain("пн 2 нояб., 10:00");
    expect(dialog.textContent).toContain("Спина");
    expect(dialog.textContent).toContain("Время станет свободным для бота");
    expect(dialog.textContent).toContain("Клиенту сообщение не придёт");

    const back = screen.getByRole<HTMLButtonElement>("button", { name: "Не отменять" });
    const confirm = screen.getByRole<HTMLButtonElement>("button", { name: "Отменить запись" });
    expect(document.activeElement).toBe(back);
    expect(confirm.className).toContain("bg-danger");
  });

  it("closes without mutating when clicking the cancel button", () => {
    const returnFocus = vi.fn(() => null);
    const { onClose } = renderDialog("cancel", vi.fn(), vi.fn(), returnFocus);

    fireEvent.click(screen.getByRole("button", { name: "Не отменять" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(act).not.toHaveBeenCalled();
    expect(returnFocus).not.toHaveBeenCalled();
  });

  it("disables actions while saving, blocks Escape, and calls onDone on success", async () => {
    let resolve!: (value: unknown) => void;
    act.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const { onClose, onDone } = renderDialog("cancel");
    const back = screen.getByRole<HTMLButtonElement>("button", { name: "Не отменять" });
    const confirm = screen.getByRole<HTMLButtonElement>("button", { name: "Отменить запись" });

    fireEvent.click(confirm);

    await waitFor(() => {
      expect(back.disabled).toBe(true);
      expect(confirm.disabled).toBe(true);
    });
    expect(act).toHaveBeenCalledWith({ id: "a1", action: "cancel" });

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();

    resolve({});
    await waitFor(() => {
      expect(onDone).toHaveBeenCalledWith("a1");
    });
  });

  it("renders no-show copy with primary confirm button and submits noShow", async () => {
    act.mockResolvedValue({});
    const { onDone } = renderDialog("noShow");
    expect(screen.getByRole("dialog", { name: "Клиент не пришёл?" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Нет, оставить" })).toBeTruthy();

    const confirm = screen.getByRole<HTMLButtonElement>("button", { name: "Да, не пришёл" });
    expect(confirm.className).toContain("bg-primary");
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(act).toHaveBeenCalledWith({ id: "a1", action: "noShow" });
      expect(onDone).toHaveBeenCalledWith("a1");
    });
  });

  it.each([
    {
      label: "409 NOT_CONFIRMED",
      err: new ApiError("problem", { status: 409, code: "NOT_CONFIRMED" }),
      text: "Запись уже изменилась. Закройте окно — на экране новое состояние.",
    },
    {
      label: "409 NOT_STARTED",
      err: new ApiError("problem", { status: 409, code: "NOT_STARTED" }),
      text: "Запись ещё не началась. Отметить «не пришёл» можно после её начала.",
    },
    {
      label: "network error",
      err: new ApiError("network"),
      text: "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.",
    },
    {
      label: "500 server error",
      err: new ApiError("server", { status: 500 }),
      text: "Не получилось сохранить. Попробуйте ещё раз через минуту.",
    },
  ])("shows $label error in alert and keeps the dialog open", async ({ err, text }) => {
    act.mockRejectedValue(err);
    const { onDone } = renderDialog("noShow");

    fireEvent.click(screen.getByRole("button", { name: "Да, не пришёл" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(text);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("moves focus to returnFocus target after success unmount, and not after cancel", async () => {
    act.mockResolvedValue({});
    const returnFocusSpy = vi.fn<() => HTMLElement | null>();

    function Harness() {
      const [open, setOpen] = useState(true);
      const nameRef = useRef<HTMLDivElement>(null);
      const triggerRef = useRef<HTMLButtonElement>(null);
      returnFocusSpy.mockImplementation(() => nameRef.current);

      return (
        <div>
          <div ref={nameRef} tabIndex={-1}>
            Айгуль Сапарова
          </div>
          <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
            Открыть
          </button>
          {open && (
            <AppointmentActionDialog
              appointment={AIGUL}
              kind="cancel"
              timeZone={TZ}
              onClose={() => setOpen(false)}
              onDone={() => setOpen(false)}
              returnFocus={() => returnFocusSpy()}
            />
          )}
        </div>
      );
    }

    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Отменить запись" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await waitFor(() => {
      expect(returnFocusSpy).toHaveBeenCalled();
      expect(document.activeElement?.textContent).toBe("Айгуль Сапарова");
    });

    returnFocusSpy.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Открыть" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Не отменять" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(returnFocusSpy).not.toHaveBeenCalled();
  });
});
