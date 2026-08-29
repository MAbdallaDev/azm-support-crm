import "@testing-library/jest-dom/vitest";

// jsdom has no PointerEvent constructor at all (confirmed against the
// version this project pins). Radix's menu primitives — DropdownMenu among
// them — open on `pointerdown`, not `click`, so any test that opens one via
// `fireEvent.pointerDown` needs a real event carrying `button`/`pointerType`,
// not the generic Event jsdom falls back to. A minimal polyfill, not a
// component-specific workaround: every future Radix interaction test needs
// this exact thing.
if (typeof window !== "undefined" && !("PointerEvent" in window)) {
  class PointerEventPolyfill extends MouseEvent {
    public pointerId?: number;
    public pointerType?: string;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId;
      this.pointerType = params.pointerType;
    }
  }
  // @ts-expect-error — assigning a polyfill onto a global jsdom does not define.
  window.PointerEvent = PointerEventPolyfill;
}
