import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";

import { useDebouncedValue } from "./useDebouncedValue";

describe("useDebouncedValue", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("keeps the old value for 300 ms and then shows the new one", async () => {
    const { result, rerender } = await renderHook(({ v }: { v: string }) => useDebouncedValue(v, 300), {
      initialProps: { v: "a" },
    });
    await rerender({ v: "b" });
    await act(async () => {
      jest.advanceTimersByTime(299);
    });
    expect(result.current).toBe("a");
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe("b");
  });

  it("restarts the wait when the value changes again", async () => {
    const { result, rerender } = await renderHook(({ v }: { v: string }) => useDebouncedValue(v, 300), {
      initialProps: { v: "a" },
    });
    await rerender({ v: "b" });
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    await rerender({ v: "c" });
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(result.current).toBe("a");
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe("c");
  });
});
