// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import type { Appointment } from "@/lib/data/schedule";

import { RescheduleDialog } from "./RescheduleDialog";

const reschedule = vi.hoisted(() => vi.fn<(vars: { id: string; start: Date }) => Promise<unknown>>());

vi.mock("@/lib/data/hooks", () => ({
  useRescheduleAppointment: () =>
    useMutation({
      mutationFn: (vars: { id: string; start: Date }) => reschedule(vars),
    }),
}));

const TZ = "Asia/Tashkent";
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

function renderDialog(onClose = vi.fn(), onDone = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RescheduleDialog
        appointment={MARAT}
        start={THU_START}
        timeZone={TZ}
        onClose={onClose}
        onDone={onDone}
      />
    </QueryClientProvider>,
  );
  return { onClose, onDone };
}

beforeEach(() => {
  reschedule.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("RescheduleDialog", () => {
  it("shows old and new slots, client text and screen-reader labels", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog", { name: "Перенести запись?" });
    expect(dialog.textContent).toContain("Марат Каримов");
    expect(dialog.textContent).toContain("Клиенту сообщение не придёт");
    expect(screen.getByText("пн 2 нояб.")).toBeTruthy();
    expect(screen.getByText("чт 5 нояб.")).toBeTruthy();
    expect(screen.getAllByText("16:00–17:00")).toHaveLength(2);
    expect(screen.getByText("Было:")).toBeTruthy();
    expect(screen.getByText("Станет:")).toBeTruthy();
  });

  it("focuses the cancel button and closes without mutating on click", () => {
    const { onClose } = renderDialog();
    const back = screen.getByRole<HTMLButtonElement>("button", { name: "Вернуть как было" });
    expect(document.activeElement).toBe(back);
    fireEvent.click(back);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(reschedule).not.toHaveBeenCalled();
  });

  it("disables actions while saving, blocks Escape, and calls onDone on success", async () => {
    let resolve!: (value: unknown) => void;
    reschedule.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const { onClose, onDone } = renderDialog();
    const back = screen.getByRole<HTMLButtonElement>("button", { name: "Вернуть как было" });
    const confirm = screen.getByRole<HTMLButtonElement>("button", { name: "Перенести" });

    fireEvent.click(confirm);

    await waitFor(() => {
      expect(back.disabled).toBe(true);
      expect(confirm.disabled).toBe(true);
    });
    expect(reschedule).toHaveBeenCalledWith({ id: "a1", start: THU_START });

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();

    resolve({});
    await waitFor(() => {
      expect(onDone).toHaveBeenCalledWith("a1");
    });
  });

  it("shows NOT_CONFIRMED conflict and keeps the dialog open", async () => {
    reschedule.mockRejectedValue(new ApiError("problem", { status: 409, code: "NOT_CONFIRMED" }));
    const { onDone } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Перенести" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "Запись уже изменилась. Закройте окно — на экране новое состояние.",
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("shows network error text", async () => {
    reschedule.mockRejectedValue(new ApiError("network"));
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Перенести" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.",
    );
  });

  it("includes old and new slots in the dialog accessible description", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog", { name: "Перенести запись?" });
    const ids = (dialog.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
    const description = ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
    expect(description).toContain("Вы перетащили запись: Марат Каримов.");
    expect(description).toContain("Было:");
    expect(description).toContain("пн 2 нояб.");
    expect(description).toContain("Станет:");
    expect(description).toContain("чт 5 нояб.");
    expect(description).toContain("16:00–17:00");
  });

  it("shows fallback error text on server 500", async () => {
    reschedule.mockRejectedValue(new ApiError("server", { status: 500 }));
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Перенести" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Не получилось перенести. Попробуйте ещё раз через минуту.");
  });

  it("uses panel copy and cancel label when via is panel", () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <RescheduleDialog
          appointment={MARAT}
          start={THU_START}
          timeZone={TZ}
          via="panel"
          onClose={vi.fn()}
          onDone={vi.fn()}
        />
      </QueryClientProvider>,
    );
    const dialog = screen.getByRole("dialog", { name: "Перенести запись?" });
    expect(dialog.textContent).toContain("Вы выбрали новое время для записи: Марат Каримов");
    expect(dialog.textContent).not.toContain("перетащили");
    expect(screen.getByRole("button", { name: "Выбрать другое время" })).toBeTruthy();
  });

  it("shows Close and calls onGone on NOT_CONFIRMED when via is panel", async () => {
    reschedule.mockRejectedValue(new ApiError("problem", { status: 409, code: "NOT_CONFIRMED" }));
    const onClose = vi.fn();
    const onGone = vi.fn();
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <RescheduleDialog
          appointment={MARAT}
          start={THU_START}
          timeZone={TZ}
          via="panel"
          onClose={onClose}
          onGone={onGone}
          onDone={vi.fn()}
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Перенести" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "Запись уже изменилась. Закройте окно — на экране новое состояние.",
    );
    const closeBtn = screen.getByRole("button", { name: "Закрыть" });
    expect(screen.queryByRole("button", { name: "Выбрать другое время" })).toBeNull();

    fireEvent.click(closeBtn);
    expect(onGone).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps Pick another time and calls onClose on TIME_TAKEN when onGone is passed", async () => {
    reschedule.mockRejectedValue(new ApiError("problem", { status: 409, code: "TIME_TAKEN" }));
    const onClose = vi.fn();
    const onGone = vi.fn();
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <RescheduleDialog
          appointment={MARAT}
          start={THU_START}
          timeZone={TZ}
          via="panel"
          onClose={onClose}
          onGone={onGone}
          onDone={vi.fn()}
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Перенести" }));

    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Выбрать другое время" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onGone).not.toHaveBeenCalled();
  });

  it("returns focus to the trigger after Close on NOT_CONFIRMED, else to returnFocus", async () => {
    const returnFocusSpy = vi.fn<() => HTMLElement | null>();

    function Harness() {
      const [open, setOpen] = useState(false);
      const [trigger, setTrigger] = useState<HTMLElement | null>(null);
      const nameRef = useRef<HTMLDivElement>(null);
      returnFocusSpy.mockImplementation(() => nameRef.current);

      return (
        <div>
          <div ref={nameRef} tabIndex={-1}>
            Марат Каримов
          </div>
          <button
            type="button"
            onClick={(event) => {
              setTrigger(event.currentTarget);
              setOpen(true);
            }}
          >
            Открыть перенос
          </button>
          {open && (
            <RescheduleDialog
              appointment={MARAT}
              start={THU_START}
              timeZone={TZ}
              via="panel"
              trigger={trigger}
              returnFocus={() => returnFocusSpy()}
              onClose={() => setOpen(false)}
              onGone={() => setOpen(false)}
              onDone={() => setOpen(false)}
            />
          )}
        </div>
      );
    }

    const mountHarness = () => {
      const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
      return render(
        <QueryClientProvider client={client}>
          <Harness />
        </QueryClientProvider>,
      );
    };

    // Case A: NOT_CONFIRMED with connected trigger focuses the trigger
    reschedule.mockRejectedValueOnce(new ApiError("problem", { status: 409, code: "NOT_CONFIRMED" }));
    const viewA = mountHarness();
    const triggerA = screen.getByRole("button", { name: "Открыть перенос" });
    fireEvent.click(triggerA);
    fireEvent.click(screen.getByRole("button", { name: "Перенести" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(triggerA);
    });
    viewA.unmount();

    // Case B: NOT_CONFIRMED when the trigger was removed falls back to returnFocus
    reschedule.mockRejectedValueOnce(new ApiError("problem", { status: 409, code: "NOT_CONFIRMED" }));
    const viewB = mountHarness();
    const triggerB = screen.getByRole("button", { name: "Открыть перенос" });
    fireEvent.click(triggerB);
    fireEvent.click(screen.getByRole("button", { name: "Перенести" }));
    await screen.findByRole("alert");
    triggerB.remove();
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement?.textContent).toBe("Марат Каримов");
    });
    viewB.unmount();

    // Case C: TIME_TAKEN + "Выбрать другое время" does not focus the trigger or call returnFocus
    returnFocusSpy.mockClear();
    reschedule.mockRejectedValueOnce(new ApiError("problem", { status: 409, code: "TIME_TAKEN" }));
    mountHarness();
    const triggerC = screen.getByRole("button", { name: "Открыть перенос" });
    fireEvent.click(triggerC);
    fireEvent.click(screen.getByRole("button", { name: "Перенести" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Выбрать другое время" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(document.activeElement).not.toBe(triggerC);
    expect(returnFocusSpy).not.toHaveBeenCalled();
  });
});
