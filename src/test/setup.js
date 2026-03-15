import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();

  try {
    window.localStorage?.clear?.();
  } catch {
    // Ignore environments where storage access is blocked.
  }
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Stub EventSource for jsdom — tests that need real behavior mock it themselves
if (!globalThis.EventSource) {
  globalThis.EventSource = class EventSource {
    constructor() {
      this.readyState = 0;
      this.onerror = null;
    }
    addEventListener() {}
    removeEventListener() {}
    close() { this.readyState = 2; }
  };
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = vi.fn();
}

if (!Element.prototype.getAnimations) {
  Element.prototype.getAnimations = vi.fn(() => []);
}

if (!SVGElement.prototype.getBBox) {
  SVGElement.prototype.getBBox = () => ({
    x: 0,
    y: 0,
    width: 120,
    height: 40,
  });
}
