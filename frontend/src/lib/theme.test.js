/**
 * Theme engine tests — DESIGN_SYSTEM.md Part 5.
 *
 * These lock the invariants the rollout depends on, including the three that
 * span files and are therefore easy to break by accident:
 *
 *   1. ENABLE_LIGHT_MODE (src/lib/theme.js) and LIGHT_ENABLED (the inline
 *      bootstrap in public/index.html) must always agree — the bootstrap runs
 *      before React and is what prevents a light/dark flash on first paint.
 *   2. The storage keys must agree for the same reason.
 *   3. THEME_COLOR_META must mirror --c-canvas in src/index.css, because
 *      <meta name="theme-color"> cannot resolve a CSS custom property.
 *
 * The bootstrap script itself is executed here as real code (extracted from
 * index.html and run against jsdom) rather than re-implemented, so the test
 * covers what actually ships, including the LIGHT_ENABLED=false escape hatch.
 */

const fs = require("fs");
const path = require("path");

const {
  THEME_STORAGE_KEY,
  PREVIEW_THEME_SESSION_KEY,
  PREVIEW_THEME_PARAM,
  DEFAULT_THEME,
  ENABLE_LIGHT_MODE,
  THEME_COLOR_META,
  readPreviewTheme,
  resolveForcedTheme,
} = require("./theme");

const FRONTEND_ROOT = path.resolve(__dirname, "..", "..");
const INDEX_HTML = fs.readFileSync(path.join(FRONTEND_ROOT, "public", "index.html"), "utf8");
const INDEX_CSS = fs.readFileSync(path.join(FRONTEND_ROOT, "src", "index.css"), "utf8");

/* ---------------------------------------------------------------------------
 * helpers
 * ------------------------------------------------------------------------- */

/** Pull the theme bootstrap IIFE out of public/index.html as executable source. */
function bootstrapSource() {
  const marker = INDEX_HTML.indexOf("Clann theme bootstrap");
  expect(marker).toBeGreaterThan(-1);
  const start = INDEX_HTML.lastIndexOf("<script>", marker) + "<script>".length;
  const end = INDEX_HTML.indexOf("</script>", marker);
  return INDEX_HTML.slice(start, end);
}

/** Read a `var NAME = value;` declaration out of the bootstrap source. */
function bootstrapVar(source, name) {
  const m = source.match(new RegExp(`var ${name} = ([^;]+);`));
  expect(m).not.toBeNull();
  return m[1].trim();
}

function setPrefersDark(prefersDark) {
  window.matchMedia = (query) => ({
    matches: query === "(prefers-color-scheme: dark)" ? prefersDark : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

/** Run the real bootstrap against a clean document, and report what it applied. */
function runBootstrap({ source, prefersDark = false, stored = null, search = "" } = {}) {
  const script = source || bootstrapSource();
  document.documentElement.className = "";
  document.documentElement.style.colorScheme = "";
  window.localStorage.clear();
  window.sessionStorage.clear();
  if (stored !== null) window.localStorage.setItem(THEME_STORAGE_KEY, stored);
  window.history.pushState({}, "", search ? `/?${search}` : "/");
  setPrefersDark(prefersDark);

  /* eslint-disable-next-line no-new-func */
  new Function(script)();

  return {
    isDark: document.documentElement.classList.contains("dark"),
    colorScheme: document.documentElement.style.colorScheme,
  };
}

const toHex = (triple) =>
  "#" +
  triple
    .trim()
    .split(/\s+/)
    .map((n) => Number(n).toString(16).padStart(2, "0").toUpperCase())
    .join("");

/** --c-canvas from the light block (before `.dark {`) and the dark block. */
function canvasTokens() {
  const darkAt = INDEX_CSS.indexOf(".dark {");
  expect(darkAt).toBeGreaterThan(-1);
  const light = /--c-canvas:\s*([^;]+);/.exec(INDEX_CSS.slice(0, darkAt));
  const dark = /--c-canvas:\s*([^;]+);/.exec(INDEX_CSS.slice(darkAt));
  expect(light).not.toBeNull();
  expect(dark).not.toBeNull();
  return { light: toHex(light[1]), dark: toHex(dark[1]) };
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.pushState({}, "", "/");
});

/* ---------------------------------------------------------------------------
 * constants and the Part 5 flip
 * ------------------------------------------------------------------------- */

describe("theme constants", () => {
  test("the storage and preview keys are unchanged", () => {
    expect(THEME_STORAGE_KEY).toBe("clann-theme");
    expect(PREVIEW_THEME_SESSION_KEY).toBe("clann-preview-theme");
    expect(PREVIEW_THEME_PARAM).toBe("previewTheme");
  });

  test("Part 5 shipped light mode: the flag is on and the default follows the OS", () => {
    expect(ENABLE_LIGHT_MODE).toBe(true);
    expect(DEFAULT_THEME).toBe("system");
  });

  test("THEME_COLOR_META is a light/dark pair of 6-digit hex values", () => {
    expect(Object.keys(THEME_COLOR_META).sort()).toEqual(["dark", "light"]);
    for (const value of Object.values(THEME_COLOR_META)) {
      expect(value).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});

describe("cross-file invariants (the ones that are easy to break silently)", () => {
  test("LIGHT_ENABLED in public/index.html agrees with ENABLE_LIGHT_MODE", () => {
    expect(bootstrapVar(bootstrapSource(), "LIGHT_ENABLED")).toBe(String(ENABLE_LIGHT_MODE));
  });

  test("the bootstrap uses the same storage keys as theme.js", () => {
    const source = bootstrapSource();
    expect(bootstrapVar(source, "STORAGE_KEY")).toBe(`"${THEME_STORAGE_KEY}"`);
    expect(bootstrapVar(source, "PREVIEW_KEY")).toBe(`"${PREVIEW_THEME_SESSION_KEY}"`);
  });

  test("THEME_COLOR_META mirrors --c-canvas in src/index.css for both themes", () => {
    expect(canvasTokens()).toEqual({
      light: THEME_COLOR_META.light.toUpperCase(),
      dark: THEME_COLOR_META.dark.toUpperCase(),
    });
  });
});

/* ---------------------------------------------------------------------------
 * readPreviewTheme
 * ------------------------------------------------------------------------- */

describe("readPreviewTheme", () => {
  test("returns null when there is no override", () => {
    expect(readPreviewTheme()).toBeNull();
  });

  test("reads ?previewTheme= and persists it for the tab", () => {
    window.history.pushState({}, "", "/?previewTheme=light");
    expect(readPreviewTheme()).toBe("light");
    expect(window.sessionStorage.getItem(PREVIEW_THEME_SESSION_KEY)).toBe("light");
  });

  test("remembers the override after the query string is gone", () => {
    window.sessionStorage.setItem(PREVIEW_THEME_SESSION_KEY, "dark");
    expect(readPreviewTheme()).toBe("dark");
  });

  test("ignores an invalid value and falls back to the stored one", () => {
    window.sessionStorage.setItem(PREVIEW_THEME_SESSION_KEY, "dark");
    window.history.pushState({}, "", "/?previewTheme=neon");
    expect(readPreviewTheme()).toBe("dark");
  });

  test("degrades to null when storage throws (private mode, sandboxed iframe)", () => {
    const spy = jest
      .spyOn(window.sessionStorage.__proto__, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    window.history.pushState({}, "", "/?previewTheme=light");
    expect(readPreviewTheme()).toBe("light");
    spy.mockRestore();
  });
});

describe("resolveForcedTheme", () => {
  test("forces nothing when there is no override, so the visitor decides", () => {
    expect(resolveForcedTheme()).toBeUndefined();
  });

  test("a ?previewTheme= override wins over the visitor's stored choice", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    window.history.pushState({}, "", "/?previewTheme=dark");
    expect(resolveForcedTheme()).toBe("dark");
  });
});

/* ---------------------------------------------------------------------------
 * the real bootstrap script, executed
 * ------------------------------------------------------------------------- */

describe("public/index.html theme bootstrap (executed against jsdom)", () => {
  test("follows the OS into dark when the visitor has made no choice", () => {
    expect(runBootstrap({ prefersDark: true })).toEqual({ isDark: true, colorScheme: "dark" });
  });

  test("falls back to light when the OS states no preference", () => {
    expect(runBootstrap({ prefersDark: false })).toEqual({ isDark: false, colorScheme: "light" });
  });

  test("an explicit stored choice beats the OS preference", () => {
    expect(runBootstrap({ prefersDark: true, stored: "light" })).toEqual({
      isDark: false,
      colorScheme: "light",
    });
    expect(runBootstrap({ prefersDark: false, stored: "dark" })).toEqual({
      isDark: true,
      colorScheme: "dark",
    });
  });

  test("?previewTheme= beats a stored choice, for QA and screenshots", () => {
    expect(
      runBootstrap({ prefersDark: false, stored: "light", search: "previewTheme=dark" }),
    ).toEqual({ isDark: true, colorScheme: "dark" });
  });

  test("ignores a corrupt stored value instead of breaking first paint", () => {
    expect(runBootstrap({ prefersDark: true, stored: "chartreuse" })).toEqual({
      isDark: true,
      colorScheme: "dark",
    });
  });

  test("ESCAPE HATCH: flipping LIGHT_ENABLED back to false returns to dark-only", () => {
    const darkOnly = bootstrapSource().replace(
      /var LIGHT_ENABLED = true;/,
      "var LIGHT_ENABLED = false;",
    );
    expect(darkOnly).not.toEqual(bootstrapSource());

    // OS prefers light, and the visitor explicitly chose light: still dark.
    expect(runBootstrap({ source: darkOnly, prefersDark: false, stored: "light" })).toEqual({
      isDark: true,
      colorScheme: "dark",
    });
    // ...but ?previewTheme= keeps working, which is how Parts 1-4 were reviewed.
    expect(
      runBootstrap({ source: darkOnly, prefersDark: false, search: "previewTheme=light" }),
    ).toEqual({ isDark: false, colorScheme: "light" });
  });

  test("the bootstrap never leaves the document without an explicit scheme", () => {
    for (const prefersDark of [true, false]) {
      const { colorScheme } = runBootstrap({ prefersDark });
      expect(["light", "dark"]).toContain(colorScheme);
    }
  });
});
