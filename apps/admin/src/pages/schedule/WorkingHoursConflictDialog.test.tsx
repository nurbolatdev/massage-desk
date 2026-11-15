// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppointmentConflict } from "@/lib/api/errors";
import { slotLines } from "@/lib/data/reschedule";

import { WorkingHoursConflictDialog } from "./WorkingHoursConflictDialog";

const TZ = "Asia/Tashkent";

afterEach(cleanup);

function makeConflict(index: number, clientName: string | null = `Клиент ${index}`): AppointmentConflict {
  const day = String(7 + index).padStart(2, "0");
  return {
    appointmentId: `a${index}`,
    clientName,
    start: `2026-11-${day}T10:00:00+05:00`,
    end: `2026-11-${day}T11:00:00+05:00`,
  };
}

function renderDialog(props?: {
  conflicts?: readonly AppointmentConflict[];
  busy?: boolean;
  error?: string;
  onConfirm?: () => void;
  onClose?: () => void;
}) {
  const onConfirm = props?.onConfirm ?? vi.fn();
  const onClose = props?.onClose ?? vi.fn();
  render(
    <WorkingHoursConflictDialog
      conflicts={props?.conflicts ?? [makeConflict(0, null)]}
      timeZone={TZ}
      busy={props?.busy}
      error={props?.error}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  );
  return { onConfirm, onClose };
}

describe("WorkingHoursConflictDialog", () => {
  it("renders single unnamed conflict, formatted time, primary confirm, and focuses cancel button", () => {
    const conflict = makeConflict(0, null);
    renderDialog({ conflicts: [conflict] });

    const dialog = screen.getByRole("dialog", { name: "Сохранить новые часы?" });
    expect(dialog.textContent).toContain(
      "1 запись не попадает в новые часы. Записи останутся — их нужно перенести или отменить самим. Новых записей в это время не будет.",
    );

    const list = within(dialog).getByRole("list", { name: "Записи вне новых часов" });
    const items = within(list).getAllByRole("listitem");
    const { day, time } = slotLines(new Date(conflict.start), new Date(conflict.end), TZ);
    expect(items).toHaveLength(1);
    expect(items[0]?.textContent).toBe(`Клиент без имени — ${day}, ${time}`);

    const back = screen.getByRole<HTMLButtonElement>("button", { name: "Изменить часы" });
    const confirm = screen.getByRole<HTMLButtonElement>("button", { name: "Да, сохранить" });
    expect(document.activeElement).toBe(back);
    expect(confirm.className).toContain("bg-primary");
  });

  it("sorts conflicts by start, caps visible list at 5, and summarizes the rest", () => {
    const unordered = [
      makeConflict(6, "Седьмой"),
      makeConflict(2, "Третий"),
      makeConflict(0, "Первый"),
      makeConflict(5, "Шестой"),
      makeConflict(1, "Второй"),
      makeConflict(4, "Пятый"),
      makeConflict(3, "Четвёртый"),
    ];
    renderDialog({ conflicts: unordered });

    const list = screen.getByRole("list", { name: "Записи вне новых часов" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(6);

    const expectedNames = ["Первый", "Второй", "Третий", "Четвёртый", "Пятый"];
    expectedNames.forEach((name, index) => {
      const conflict = makeConflict(index, name);
      const { day, time } = slotLines(new Date(conflict.start), new Date(conflict.end), TZ);
      expect(items[index]?.textContent).toBe(`${name} — ${day}, ${time}`);
    });
    expect(items[5]?.textContent).toBe("И ещё 2 записи.");
  });

  it("calls onConfirm on confirm and onClose on cancel or Escape", () => {
    const { onConfirm, onClose } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Да, сохранить" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Изменить часы" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("disables buttons and blocks Escape while busy, and shows save error alert", () => {
    const { onConfirm, onClose } = renderDialog({
      busy: true,
      error: "Сервер ответил с ошибкой. Код: 500. Часы не сохранены.",
    });

    const back = screen.getByRole<HTMLButtonElement>("button", { name: "Изменить часы" });
    const confirm = screen.getByRole<HTMLButtonElement>("button", { name: "Да, сохранить" });
    expect(back.disabled).toBe(true);
    expect(confirm.disabled).toBe(true);

    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Сервер ответил с ошибкой. Код: 500. Часы не сохранены.");
  });
});
