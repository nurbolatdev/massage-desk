// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DAY_PROBLEM_TEXT, type HoursRange, type WeekDraft } from "@/lib/data/workingHours";

import { WorkingHoursDay } from "./WorkingHoursDay";

afterEach(cleanup);

function DayHarness({ initial, disabled = false }: { initial: HoursRange[]; disabled?: boolean }) {
  const [draft, setDraft] = useState<WeekDraft>(() =>
    Array.from({ length: 7 }, (_, i) => (i === 0 ? initial : [])),
  );
  return <WorkingHoursDay day={0} ranges={draft[0] ?? []} disabled={disabled} onChange={setDraft} />;
}

function mondayGroup() {
  return within(screen.getByRole("group", { name: "Понедельник" }));
}

describe("WorkingHoursDay", () => {
  it("renders range fields with accessible labels and unchecked day-off checkbox", () => {
    render(
      <DayHarness
        initial={[
          { start: "09:00", end: "13:00" },
          { start: "14:00", end: "19:00" },
        ]}
      />,
    );

    const group = mondayGroup();
    expect(group.getByLabelText<HTMLInputElement>("Понедельник, время 1: начало").value).toBe("09:00");
    expect(group.getByLabelText<HTMLInputElement>("Понедельник, время 1: конец").value).toBe("13:00");
    expect(group.getByLabelText<HTMLInputElement>("Понедельник, время 2: начало").value).toBe("14:00");
    expect(group.getByLabelText<HTMLInputElement>("Понедельник, время 2: конец").value).toBe("19:00");
    expect(group.getByRole("checkbox", { name: "Выходной" }).getAttribute("aria-checked")).toBe("false");
  });

  it("updates a range boundary on change", () => {
    render(
      <DayHarness
        initial={[
          { start: "09:00", end: "13:00" },
          { start: "14:00", end: "19:00" },
        ]}
      />,
    );

    const group = mondayGroup();
    const firstEnd = group.getByLabelText<HTMLInputElement>("Понедельник, время 1: конец");
    fireEvent.change(firstEnd, { target: { value: "12:00" } });
    expect(firstEnd.value).toBe("12:00");
  });

  it("adds ranges up to 4 and disables the add button at the limit", () => {
    render(
      <DayHarness
        initial={[
          { start: "09:00", end: "13:00" },
          { start: "14:00", end: "19:00" },
        ]}
      />,
    );

    const group = mondayGroup();
    const addButton = group.getByRole<HTMLButtonElement>("button", { name: "Добавить время" });
    expect(addButton.disabled).toBe(false);

    fireEvent.click(addButton);
    expect(group.getByLabelText<HTMLInputElement>("Понедельник, время 3: начало").value).toBe("20:00");
    expect(group.getByLabelText<HTMLInputElement>("Понедельник, время 3: конец").value).toBe("21:00");
    expect(addButton.disabled).toBe(false);

    fireEvent.click(addButton);
    expect(group.getByLabelText<HTMLInputElement>("Понедельник, время 4: начало").value).toBe("22:00");
    expect(group.getByLabelText<HTMLInputElement>("Понедельник, время 4: конец").value).toBe("23:00");
    expect(addButton.disabled).toBe(true);
  });

  it("removes ranges and turns the day into a day off when removing the last range", () => {
    render(
      <DayHarness
        initial={[
          { start: "09:00", end: "13:00" },
          { start: "14:00", end: "19:00" },
        ]}
      />,
    );

    const group = mondayGroup();
    fireEvent.click(group.getByRole("button", { name: "Удалить: Понедельник, время 2" }));
    expect(group.queryByLabelText("Понедельник, время 2: начало")).toBeNull();
    expect(group.getByLabelText<HTMLInputElement>("Понедельник, время 1: начало").value).toBe("09:00");

    fireEvent.click(group.getByRole("button", { name: "Удалить: Понедельник, время 1" }));
    expect(group.getByRole("checkbox", { name: "Выходной" }).getAttribute("aria-checked")).toBe("true");
    expect(group.queryByLabelText("Понедельник, время 1: начало")).toBeNull();
    expect(group.queryByRole("button", { name: "Добавить время" })).toBeNull();
  });

  it("toggles day off on and off", () => {
    render(<DayHarness initial={[{ start: "10:00", end: "15:00" }]} />);

    const group = mondayGroup();
    const dayOff = group.getByRole("checkbox", { name: "Выходной" });
    fireEvent.click(dayOff);
    expect(dayOff.getAttribute("aria-checked")).toBe("true");
    expect(group.queryByLabelText("Понедельник, время 1: начало")).toBeNull();

    fireEvent.click(dayOff);
    expect(dayOff.getAttribute("aria-checked")).toBe("false");
    expect(group.getByLabelText<HTMLInputElement>("Понедельник, время 1: начало").value).toBe("09:00");
    expect(group.getByLabelText<HTMLInputElement>("Понедельник, время 1: конец").value).toBe("18:00");
  });

  it("shows empty, order, and overlap errors with aria-invalid and aria-describedby, and clears them when valid", () => {
    render(
      <DayHarness
        initial={[
          { start: "09:00", end: "13:00" },
          { start: "14:00", end: "19:00" },
        ]}
      />,
    );

    const group = mondayGroup();
    const firstStart = group.getByLabelText<HTMLInputElement>("Понедельник, время 1: начало");
    const firstEnd = group.getByLabelText<HTMLInputElement>("Понедельник, время 1: конец");
    const secondStart = group.getByLabelText<HTMLInputElement>("Понедельник, время 2: начало");
    const secondEnd = group.getByLabelText<HTMLInputElement>("Понедельник, время 2: конец");

    expect(firstStart.getAttribute("aria-invalid")).toBe("false");
    expect(firstStart.getAttribute("aria-describedby")).toBeNull();
    expect(secondEnd.getAttribute("aria-describedby")).toBeNull();

    fireEvent.change(secondStart, { target: { value: "12:00" } });
    const overlapError = group.getByText(DAY_PROBLEM_TEXT.overlap);
    expect(overlapError.id).not.toBe("");
    for (const input of [firstStart, firstEnd, secondStart, secondEnd]) {
      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(input.getAttribute("aria-describedby")).toBe(overlapError.id);
    }

    fireEvent.change(secondStart, { target: { value: "" } });
    expect(group.getByText(DAY_PROBLEM_TEXT.empty).id).toBe(overlapError.id);

    fireEvent.change(secondStart, { target: { value: "19:30" } });
    expect(group.getByText(DAY_PROBLEM_TEXT.order).id).toBe(overlapError.id);

    fireEvent.change(secondStart, { target: { value: "14:00" } });
    expect(group.queryByText(DAY_PROBLEM_TEXT.order)).toBeNull();
    expect(firstStart.getAttribute("aria-invalid")).toBe("false");
    expect(firstStart.getAttribute("aria-describedby")).toBeNull();
  });

  it("disables all inputs, checkbox, remove buttons, and add button when disabled", () => {
    render(
      <DayHarness
        disabled
        initial={[
          { start: "09:00", end: "13:00" },
          { start: "14:00", end: "19:00" },
        ]}
      />,
    );

    const group = mondayGroup();
    expect(group.getByRole<HTMLButtonElement>("checkbox", { name: "Выходной" }).disabled).toBe(true);
    expect(group.getByLabelText<HTMLInputElement>("Понедельник, время 1: начало").disabled).toBe(true);
    expect(group.getByLabelText<HTMLInputElement>("Понедельник, время 1: конец").disabled).toBe(true);
    expect(group.getByLabelText<HTMLInputElement>("Понедельник, время 2: начало").disabled).toBe(true);
    expect(group.getByLabelText<HTMLInputElement>("Понедельник, время 2: конец").disabled).toBe(true);
    expect(group.getByRole<HTMLButtonElement>("button", { name: "Удалить: Понедельник, время 1" }).disabled).toBe(true);
    expect(group.getByRole<HTMLButtonElement>("button", { name: "Удалить: Понедельник, время 2" }).disabled).toBe(true);
    expect(group.getByRole<HTMLButtonElement>("button", { name: "Добавить время" }).disabled).toBe(true);
  });
});
