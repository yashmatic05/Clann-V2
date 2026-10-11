/**
 * Jest setup — DESIGN_SYSTEM.md Part 5 (the rollout's first tests).
 *
 * Registered via setupFilesAfterEnv in craco.config.js, so this runs once per
 * test file before any test module is imported. It only polyfills browser APIs
 * that jsdom does not implement but the theme stack calls at import/render
 * time. Nothing here changes app behaviour: the real browser provides all of
 * these natively.
 */

/* jsdom has no window.matchMedia. next-themes calls it to resolve
 * `defaultTheme="system"`, framer-motion's useReducedMotion calls it for
 * prefers-reduced-motion, and the inline bootstrap script in public/index.html
 * calls it for prefers-color-scheme. Without this polyfill those throw.
 *
 * Both the current (addEventListener) and the deprecated (addListener) APIs are
 * stubbed, because next-themes still uses the deprecated pair on older paths.
 * `matches: false` means "no preference", which resolves to the light theme —
 * tests that need dark set it explicitly via setMatchMedia() below. */
const createMatchMedia = (matchesByQuery = {}) => (query) => ({
  matches: Object.prototype.hasOwnProperty.call(matchesByQuery, query)
    ? matchesByQuery[query]
    : false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
});

/**
 * Test helper: point matchMedia at a specific result.
 *
 *   setMatchMedia({ "(prefers-color-scheme: dark)": true });
 *
 * Pass {} to reset to "no preference" for everything.
 */
const setMatchMedia = (matchesByQuery) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: createMatchMedia(matchesByQuery),
  });
};

if (typeof window !== "undefined") {
  setMatchMedia({});

  /* jsdom has no ResizeObserver, which Radix primitives measure with. */
  if (!window.ResizeObserver) {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
}

/* Make the helper importable from tests without adding a dependency:
 * `import { setMatchMedia } from "@/setupTests";` */
module.exports = { setMatchMedia, createMatchMedia };

/* jsdom's CSSOM silently discards declarations it cannot parse, and
 * `rgb(var(--c-ink) / 1)` is exactly such a value — so reading a token colour
 * back off a rendered element's style never works. Component tests therefore
 * assert on the class names via react-dom/server's renderToStaticMarkup, and
 * token DEFINITIONS are asserted by reading src/index.css as text. Both
 * approaches are used in the tests alongside this file. */
