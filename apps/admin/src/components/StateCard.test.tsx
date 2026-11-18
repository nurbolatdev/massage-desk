// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { StateCard } from "@/components/StateCard";

afterEach(cleanup);

describe("StateCard", () => {
  it("renders the title, text and action", () => {
    render(
      <StateCard
        icon={Inbox}
        title="Записей нет"
        text="Новые записи появятся здесь."
        action={<button type="button">Повторить</button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "Записей нет" })).toBeTruthy();
    expect(screen.getByText("Новые записи появятся здесь.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeTruthy();
  });
});
