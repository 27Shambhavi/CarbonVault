// src/__tests__/setup.js
import { vi } from 'vitest';

// Polyfill window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
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

// Polyfill ResizeObserver
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Polyfill IntersectionObserver
globalThis.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Polyfill scrollTo & print
window.scrollTo = vi.fn();
window.print = vi.fn();

// Mock localStorage
const localStorageMock = (function () {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});
