import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useResizableWidth } from "@/lib/useResizableWidth";

const OPTIONS = { storageKey: "test.width", defaultWidth: 300, min: 260, max: 480 };

const drag = (startX: number, endX: number) => {
  window.dispatchEvent(new PointerEvent("pointermove", { clientX: endX }));
  window.dispatchEvent(new PointerEvent("pointerup", { clientX: endX }));
};

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.dir = "ltr";
});

afterEach(() => {
  document.documentElement.dir = "ltr";
});

describe("useResizableWidth", () => {
  it("starts at defaultWidth when nothing is stored", () => {
    const { result } = renderHook(() => useResizableWidth(OPTIONS));
    expect(result.current.width).toBe(300);
  });

  it("restores a previously persisted width, clamped to the current range", () => {
    window.localStorage.setItem("test.width", "350");
    const { result } = renderHook(() => useResizableWidth(OPTIONS));
    expect(result.current.width).toBe(350);
  });

  it("ignores a stored value outside the current min/max", () => {
    window.localStorage.setItem("test.width", "9999");
    const { result } = renderHook(() => useResizableWidth(OPTIONS));
    expect(result.current.width).toBe(300);
  });

  it("grows when dragged toward the end edge in LTR, and persists the result", () => {
    const { result } = renderHook(() => useResizableWidth(OPTIONS));

    act(() => {
      result.current.onPointerDown({
        clientX: 100,
        preventDefault: () => {},
      } as React.PointerEvent);
      drag(100, 140);
    });

    expect(result.current.width).toBe(340);
    expect(window.localStorage.getItem("test.width")).toBe("340");
  });

  it("clamps to max even if the drag would exceed it", () => {
    const { result } = renderHook(() => useResizableWidth(OPTIONS));

    act(() => {
      result.current.onPointerDown({ clientX: 0, preventDefault: () => {} } as React.PointerEvent);
      drag(0, 10000);
    });

    expect(result.current.width).toBe(480);
  });

  it("reverses drag direction in RTL — dragging toward the start edge still grows the panel", () => {
    document.documentElement.dir = "rtl";
    const { result } = renderHook(() => useResizableWidth(OPTIONS));

    act(() => {
      result.current.onPointerDown({ clientX: 100, preventDefault: () => {} } as React.PointerEvent);
      drag(100, 60); // moved left (toward the document's start edge in RTL)
    });

    expect(result.current.width).toBe(340);
  });

  it("arrow keys resize by a fixed step and persist immediately", () => {
    const { result } = renderHook(() => useResizableWidth(OPTIONS));

    act(() => {
      result.current.onKeyDown({
        key: "ArrowRight",
        preventDefault: () => {},
      } as React.KeyboardEvent);
    });

    expect(result.current.width).toBe(316);
    expect(window.localStorage.getItem("test.width")).toBe("316");
  });

  it("reset returns to defaultWidth and clears storage", () => {
    window.localStorage.setItem("test.width", "400");
    const { result } = renderHook(() => useResizableWidth(OPTIONS));

    act(() => result.current.reset());

    expect(result.current.width).toBe(300);
    expect(window.localStorage.getItem("test.width")).toBeNull();
  });
});
