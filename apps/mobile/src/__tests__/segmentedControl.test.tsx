import { describe, expect, it, jest } from "@jest/globals";
import { render, screen, userEvent } from "@testing-library/react-native";

import { SegmentedControl } from "@/components/SegmentedControl";

const OPTIONS = [
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
] as const;

async function renderControl(onChange: (value: "week" | "month") => void) {
  await render(<SegmentedControl options={OPTIONS} value="week" onChange={onChange} accessibilityLabel="Вид" />);
}

describe("SegmentedControl", () => {
  it("renders both labels inside a labelled tablist", async () => {
    await renderControl(jest.fn());
    expect(screen.getByText("Неделя")).toBeOnTheScreen();
    expect(screen.getByText("Месяц")).toBeOnTheScreen();
    expect(screen.getByLabelText("Вид").props.accessibilityRole).toBe("tablist");
    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });

  it("marks only the current value as selected", async () => {
    await renderControl(jest.fn());
    expect(screen.getByRole("tab", { name: "Неделя" }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByRole("tab", { name: "Месяц" }).props.accessibilityState).toMatchObject({ selected: false });
  });

  it("calls onChange when the other segment is pressed", async () => {
    const onChange = jest.fn<(value: "week" | "month") => void>();
    const user = userEvent.setup();
    await renderControl(onChange);
    await user.press(screen.getByRole("tab", { name: "Месяц" }));
    expect(onChange).toHaveBeenCalledWith("month");
  });

  it("does not call onChange when the selected segment is pressed", async () => {
    const onChange = jest.fn<(value: "week" | "month") => void>();
    const user = userEvent.setup();
    await renderControl(onChange);
    await user.press(screen.getByRole("tab", { name: "Неделя" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
