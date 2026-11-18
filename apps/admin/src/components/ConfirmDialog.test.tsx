// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";

afterEach(cleanup);

function renderDialog(props?: {
  open?: boolean;
  confirmVariant?: "primary" | "destructive-solid";
  onCloseAutoFocus?: (event: Event) => void;
}) {
  return render(
    <ConfirmDialog
      open={props?.open ?? true}
      onOpenChange={vi.fn()}
      title="Отменить запись?"
      text="Время станет свободным для бота."
      confirmLabel="Отменить запись"
      cancelLabel="Не отменять"
      onConfirm={vi.fn()}
      confirmVariant={props?.confirmVariant}
      onCloseAutoFocus={props?.onCloseAutoFocus}
    />,
  );
}

describe("ConfirmDialog", () => {
  it("uses primary confirm button and focuses the cancel button by default", () => {
    renderDialog();
    const cancel = screen.getByRole("button", { name: "Не отменять" });
    const confirm = screen.getByRole("button", { name: "Отменить запись" });
    expect(document.activeElement).toBe(cancel);
    expect(confirm.className).toContain("bg-primary");
  });

  it("renders destructive-solid confirm button when confirmVariant is set", () => {
    renderDialog({ confirmVariant: "destructive-solid" });
    const confirm = screen.getByRole("button", { name: "Отменить запись" });
    expect(confirm.className).toContain("bg-danger");
  });

  it("calls onCloseAutoFocus when the dialog closes", async () => {
    const onCloseAutoFocus = vi.fn();
    const { rerender } = renderDialog({ open: true, onCloseAutoFocus });
    rerender(
      <ConfirmDialog
        open={false}
        onOpenChange={vi.fn()}
        title="Отменить запись?"
        text="Время станет свободным для бота."
        confirmLabel="Отменить запись"
        cancelLabel="Не отменять"
        onConfirm={vi.fn()}
        onCloseAutoFocus={onCloseAutoFocus}
      />,
    );
    await waitFor(() => {
      expect(onCloseAutoFocus).toHaveBeenCalledTimes(1);
    });
  });

  it("styles destructive button with danger border and text", () => {
    render(<Button variant="destructive">Отменить</Button>);
    const button = screen.getByRole("button", { name: "Отменить" });
    expect(button.className).toContain("border-danger-border");
    expect(button.className).toContain("text-danger");
  });
});
