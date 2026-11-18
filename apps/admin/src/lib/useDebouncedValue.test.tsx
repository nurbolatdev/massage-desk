// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDebouncedValue } from "./useDebouncedValue";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useDebouncedValue", () => {
  it("updates the value only after the 300 ms delay", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "А" },
    });

    expect(result.current).toBe("А");

    rerender({ value: "Айг" });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe("А");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("Айг");
  });

  it("collapses rapid updates into the final value", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "" },
    });

    rerender({ value: "А" });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ value: "Ай" });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ value: "Айг" });

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe("");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("Айг");
  });
});
