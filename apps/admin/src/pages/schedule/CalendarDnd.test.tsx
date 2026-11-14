// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { weekDays } from "@massage-desk/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { DRAG_CANCELLED } from "@/lib/data/reschedule";
import type { Appointment } from "@/lib/data/schedule";

import { CalendarDnd } from "./CalendarDnd";
import { DayColumn } from "./DayColumn";

const TZ = "Asia/Tashkent";
const DAYS = weekDays("2026-11-02");
const RANGE = { start: 9, end: 19 };
const HOURS = Array.from({ length: 10 }, (_, i) => 9 + i);

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

function setupGeometry(rowHeight = "18.2px") {
  const realGetComputedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((el, pseudo) => {
    const style = realGetComputedStyle(el, pseudo);
    if (el instanceof HTMLElement && el.hasAttribute("data-grid-column")) {
      return new Proxy(style, {
        get(target, prop) {
          if (prop === "gridAutoRows") return rowHeight;
          const value = Reflect.get(target, prop, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    }
    return style;
  });

  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-grid-column")) {
      return new DOMRect(0, 0, 100, 728);
    }
    if (this.tagName === "BUTTON") {
      // Fractional vertical center (182.1 + 36.4 / 2 = 200.3)
      return new DOMRect(0, 182.1, 100, 36.4);
    }
    return new DOMRect(0, 0, 0, 0);
  });
}

const hadDocGetAnimations = typeof document.getAnimations === "function";
const origDocGetAnimations = document.getAnimations;
const hadElGetAnimations = typeof Element.prototype.getAnimations === "function";
const origElGetAnimations = Element.prototype.getAnimations;
const hadElAnimate = typeof Element.prototype.animate === "function";
const origElAnimate = Element.prototype.animate;
const hadElementFromPoint = typeof document.elementFromPoint === "function";
const origElementFromPoint = document.elementFromPoint;
const hadMatchMedia = typeof window.matchMedia === "function";
const origMatchMedia = window.matchMedia;

let triggerResize: (() => void) | undefined;
let observed: Element[] = [];

beforeAll(() => {
  if (!hadDocGetAnimations) {
    Object.defineProperty(document, "getAnimations", { value: () => [], configurable: true });
  }
  if (!hadElGetAnimations) {
    Object.defineProperty(Element.prototype, "getAnimations", { value: () => [], configurable: true });
  }
  if (!hadElAnimate) {
    Object.defineProperty(Element.prototype, "animate", {
      value: () => ({ finished: Promise.resolve(), cancel: () => {} }),
      configurable: true,
    });
  }
  if (!hadElementFromPoint) {
    Object.defineProperty(document, "elementFromPoint", { value: () => null, configurable: true });
  }
  if (!hadMatchMedia) {
    Object.defineProperty(window, "matchMedia", {
      value: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
      configurable: true,
    });
  }
});

afterAll(() => {
  if (!hadDocGetAnimations) Reflect.deleteProperty(document, "getAnimations");
  else Object.defineProperty(document, "getAnimations", { value: origDocGetAnimations, configurable: true });
  if (!hadElGetAnimations) Reflect.deleteProperty(Element.prototype, "getAnimations");
  else Object.defineProperty(Element.prototype, "getAnimations", { value: origElGetAnimations, configurable: true });
  if (!hadElAnimate) Reflect.deleteProperty(Element.prototype, "animate");
  else Object.defineProperty(Element.prototype, "animate", { value: origElAnimate, configurable: true });
  if (!hadElementFromPoint) Reflect.deleteProperty(document, "elementFromPoint");
  else Object.defineProperty(document, "elementFromPoint", { value: origElementFromPoint, configurable: true });
  if (!hadMatchMedia) Reflect.deleteProperty(window, "matchMedia");
  else Object.defineProperty(window, "matchMedia", { value: origMatchMedia, configurable: true });
});

function stubResizeObserver() {
  observed = [];
  triggerResize = undefined;
  vi.stubGlobal(
    "ResizeObserver",
    class MockResizeObserver implements ResizeObserver {
      private cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
        triggerResize = () => this.cb([], this);
      }
      observe(el: Element) {
        observed.push(el);
      }
      disconnect() {}
      unobserve() {}
    },
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("CalendarDnd", () => {
  it("announces drag start, 1-row move at 18.2px step, and drop in Russian live region", async () => {
    stubResizeObserver();
    setupGeometry("18.2px");
    const onDrop = vi.fn();

    render(
      <CalendarDnd days={DAYS} range={RANGE} timeZone={TZ} appointments={[MARAT]} onDrop={onDrop}>
        <DayColumn
          day={DAYS[0] ?? "2026-11-02"}
          windows={undefined}
          off={false}
          list={[MARAT]}
          range={RANGE}
          hours={HOURS}
          timeZone={TZ}
          timeOff={[]}
          selectedId={null}
          onSelect={vi.fn()}
          draggable
        />
      </CalendarDnd>,
    );

    const block = screen.getByRole("button", { name: /Марат Каримов/ });
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");

    block.focus();
    fireEvent.keyDown(block, { key: " ", code: "Space" });

    await waitFor(() => {
      expect(status.textContent).toBe("Запись: Марат Каримов, пн 2 нояб., 16:00. Двигайте стрелками.");
    });

    fireEvent.keyDown(document, { key: "ArrowDown", code: "ArrowDown" });

    await waitFor(() => {
      expect(status.textContent).toBe("Новое время: пн 2 нояб., 16:15.");
    });

    fireEvent.keyDown(document, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(onDrop).toHaveBeenCalledTimes(1);
    });
    expect(onDrop.mock.calls[0]?.[1].toISOString()).toBe("2026-11-02T11:15:00.000Z");
    expect(status.textContent).toBe("Новое время: пн 2 нояб., 16:15. Подтвердите перенос.");
  });

  it("cancels keyboard dragging on Tab and announces cancellation", async () => {
    stubResizeObserver();
    setupGeometry("18.2px");
    const onDrop = vi.fn();

    render(
      <CalendarDnd days={DAYS} range={RANGE} timeZone={TZ} appointments={[MARAT]} onDrop={onDrop}>
        <DayColumn
          day={DAYS[0] ?? "2026-11-02"}
          windows={undefined}
          off={false}
          list={[MARAT]}
          range={RANGE}
          hours={HOURS}
          timeZone={TZ}
          timeOff={[]}
          selectedId={null}
          onSelect={vi.fn()}
          draggable
        />
      </CalendarDnd>,
    );

    const block = screen.getByRole("button", { name: /Марат Каримов/ });
    const status = screen.getByRole("status");

    block.focus();
    fireEvent.keyDown(block, { key: " ", code: "Space" });
    await waitFor(() => {
      expect(status.textContent).toContain("Марат Каримов");
    });

    fireEvent.keyDown(document, { key: "ArrowDown", code: "ArrowDown" });
    await waitFor(() => {
      expect(status.textContent).toBe("Новое время: пн 2 нояб., 16:15.");
    });

    fireEvent.keyDown(document, { key: "Tab", code: "Tab" });

    await waitFor(() => {
      expect(status.textContent).toBe(DRAG_CANCELLED);
    });
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("observes the persistent root container so step updates after columns are replaced", async () => {
    stubResizeObserver();
    let rowHeight = "14px";
    setupGeometry("14px");
    vi.spyOn(window, "getComputedStyle").mockImplementation((el) => {
      const style = document.createElement("div").style;
      if (el instanceof HTMLElement && el.hasAttribute("data-grid-column")) {
        return new Proxy(style, {
          get(target, prop) {
            if (prop === "gridAutoRows") return rowHeight;
            const value = Reflect.get(target, prop, target);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
      }
      return style;
    });

    const onDrop = vi.fn();
    const { container, rerender } = render(
      <CalendarDnd days={DAYS} range={RANGE} timeZone={TZ} appointments={[MARAT]} onDrop={onDrop}>
        <DayColumn
          key="week-1"
          day={DAYS[0] ?? "2026-11-02"}
          windows={undefined}
          off={false}
          list={[MARAT]}
          range={RANGE}
          hours={HOURS}
          timeZone={TZ}
          timeOff={[]}
          selectedId={null}
          onSelect={vi.fn()}
          draggable
        />
      </CalendarDnd>,
    );

    expect(observed).toHaveLength(1);
    expect(observed[0]).toBe(container.firstElementChild);
    expect(observed[0]?.hasAttribute("data-grid-column")).toBe(false);

    // Replace the DayColumn with a fresh one (simulating week switch) and change row height to 18.2px.
    rowHeight = "18.2px";
    rerender(
      <CalendarDnd days={DAYS} range={RANGE} timeZone={TZ} appointments={[MARAT]} onDrop={onDrop}>
        <DayColumn
          key="week-2"
          day={DAYS[0] ?? "2026-11-02"}
          windows={undefined}
          off={false}
          list={[MARAT]}
          range={RANGE}
          hours={HOURS}
          timeZone={TZ}
          timeOff={[]}
          selectedId={null}
          onSelect={vi.fn()}
          draggable
        />
      </CalendarDnd>,
    );

    triggerResize?.();

    const block = screen.getByRole("button", { name: /Марат Каримов/ });
    block.focus();
    fireEvent.keyDown(block, { key: " ", code: "Space" });
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain("Марат Каримов");
    });
    fireEvent.keyDown(document, { key: "ArrowDown", code: "ArrowDown" });
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("Новое время: пн 2 нояб., 16:15.");
    });
  });
});
