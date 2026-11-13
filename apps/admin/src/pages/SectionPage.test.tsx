// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { sections } from "@/sections";

vi.mock("@/lib/auth/roleContext", () => ({ useStaffRole: () => "admin" }));

const schedule = sections.find((s) => s.id === "schedule");
if (!schedule) throw new Error("schedule section is missing");

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  cleanup();
  vi.doUnmock("./schedule/SchedulePage");
  vi.restoreAllMocks();
});

describe("SectionPage", () => {
  it("shows the skeleton first and then the loaded page", async () => {
    vi.doMock("./schedule/SchedulePage", () => ({ SchedulePage: () => <h1>Расписание</h1> }));
    const { SectionPage } = await import("./SectionPage");
    const { container } = render(<SectionPage section={schedule} />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(await screen.findByRole("heading", { name: "Расписание" })).not.toBeNull();
  });

  it("shows a Russian message with a reload button when the page chunk fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.doMock("./schedule/SchedulePage", () => {
      throw new Error("Failed to fetch dynamically imported module");
    });
    const { SectionPage } = await import("./SectionPage");
    render(<SectionPage section={schedule} />);
    expect(await screen.findByText("Не удалось открыть раздел")).not.toBeNull();
    expect(screen.getByText("Проверьте связь и обновите страницу.")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Обновить страницу" })).not.toBeNull();
  });
});
