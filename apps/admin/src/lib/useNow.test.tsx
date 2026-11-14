// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { useNow } from "./useNow";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-02T04:35:00Z"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useNow", () => {
  it("ticks every interval and clears the timer on unmount", () => {
    const { result, unmount } = renderHook(() => useNow());
    expect(result.current.toISOString()).toBe("2026-11-02T04:35:00.000Z");

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.toISOString()).toBe("2026-11-02T04:36:00.000Z");
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aligns the first tick to the minute boundary and clears timeout on early unmount", () => {
    vi.setSystemTime(new Date("2026-11-02T04:35:20Z"));
    const { result, unmount } = renderHook(() => useNow());
    expect(result.current.toISOString()).toBe("2026-11-02T04:35:20.000Z");

    act(() => {
      vi.advanceTimersByTime(39_999);
    });
    expect(result.current.toISOString()).toBe("2026-11-02T04:35:20.000Z");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.toISOString()).toBe("2026-11-02T04:36:00.000Z");

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.toISOString()).toBe("2026-11-02T04:37:00.000Z");

    unmount();
    expect(vi.getTimerCount()).toBe(0);

    const early = renderHook(() => useNow());
    expect(vi.getTimerCount()).toBe(1);
    early.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
