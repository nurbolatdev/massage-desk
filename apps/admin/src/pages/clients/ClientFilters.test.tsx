// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { ClientFilters } from "./ClientFilters";

afterEach(cleanup);

describe("ClientFilters", () => {
  it("renders four chips in order with the selected one pressed", () => {
    render(<ClientFilters value="regular" onChange={() => {}} />);
    const group = screen.getByRole("group", { name: "Фильтр" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual([
      "Все",
      "Постоянные",
      "Давно не были",
      "С неявками",
    ]);
    expect(buttons.map((b) => b.getAttribute("aria-pressed"))).toEqual([
      "false",
      "true",
      "false",
      "false",
    ]);
    expect(buttons[1]!.className).toContain("bg-ink");
    expect(buttons[0]!.className).toContain("bg-surface");
  });

  it("reports the picked segment", () => {
    const onChange = vi.fn();
    render(<ClientFilters value="all" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Давно не были" }));
    expect(onChange).toHaveBeenCalledWith("lapsed");
  });
});
