import { describe, expect, it } from "vitest";

import { canOpen, isActive, sections, visibleSections } from "./sections";

function find(id: string) {
  const section = sections.find((s) => s.id === id);
  if (!section) {
    throw new Error(`no section ${id}`);
  }
  return section;
}

describe("sections", () => {
  it("lists the labels in the mockup order", () => {
    expect(sections.map((s) => s.label)).toEqual([
      "Обзор",
      "Расписание",
      "Клиенты",
      "Диалоги",
      "AI-диагностика",
      "Настройки",
      "Система",
    ]);
  });

  it("has unique paths", () => {
    expect(new Set(sections.map((s) => s.path)).size).toBe(sections.length);
  });

  it("shows the master five sections without AI diagnostics and System", () => {
    const labels = visibleSections("master").map((s) => s.label);
    expect(labels).toHaveLength(5);
    expect(labels).not.toContain("AI-диагностика");
    expect(labels).not.toContain("Система");
  });

  it("shows the admin all seven sections", () => {
    expect(visibleSections("admin")).toHaveLength(7);
  });

  it("does not let the master open AI diagnostics", () => {
    expect(canOpen("master", find("ai"))).toBe(false);
    expect(canOpen("admin", find("ai"))).toBe(true);
  });

  it("matches the overview only exactly", () => {
    const overview = find("overview");
    expect(isActive("/", overview)).toBe(true);
    expect(isActive("/clients", overview)).toBe(false);
  });

  it("matches other sections by path prefix", () => {
    const clients = find("clients");
    expect(isActive("/clients", clients)).toBe(true);
    expect(isActive("/clients/1", clients)).toBe(true);
    expect(isActive("/clientsx", clients)).toBe(false);
  });
});
