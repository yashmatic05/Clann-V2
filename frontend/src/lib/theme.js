/**
 * Clann theme engine — DESIGN_SYSTEM.md section R2/R7 and Part 1b of the
 * design-system rollout.
 *
 * One layout, two token sets. `next-themes` puts a `.light`/`.dark` class on
 * <html>; src/index.css swaps the --c-* custom properties underneath it, and
 * tailwind.config.js exposes those properties as colour utilities. Components
 * never contain hex codes and never branch on the theme.
 *
 * ---------------------------------------------------------------------------
 * ROLLOUT STATE — Part 5 (complete): light mode is LIVE
 * ---------------------------------------------------------------------------
 * `ENABLE_LIGHT_MODE` is true and `DEFAULT_THEME` is "system", so visitors get
 * their operating system's preference and can override it with the ThemeToggle
 * in the Navbar (and pinned to the viewport on the pages that have no Navbar).
 * `LIGHT_ENABLED` in the inline bootstrap script in public/index.html is the
 * same switch expressed before React runs; the two must always agree, because
 * that script is what prevents a light/dark flash on first paint.
 *
 * Flipping `ENABLE_LIGHT_MODE` back to false is the supported escape hatch: it
 * returns the whole app to dark-only without touching a single component.
 *
 * `?previewTheme=light` / `?previewTheme=dark` still forces a theme for the
 * current tab only (remembered in sessionStorage). It was the review mechanism
 * while light mode was dark-only behind the flag, and it is kept now because it
 * remains the only way to force a theme without editing the visitor's stored
 * choice — useful for screenshots, QA and side-by-side theme review. It wins
 * over both the stored choice and the system preference.
 */

/** localStorage key next-themes persists the visitor's explicit choice under. */
export const THEME_STORAGE_KEY = "clann-theme";

/** sessionStorage key for the tab-scoped ?previewTheme override. */
export const PREVIEW_THEME_SESSION_KEY = "clann-preview-theme";

/** URL query parameter that forces a theme for the current tab. */
export const PREVIEW_THEME_PARAM = "previewTheme";

/**
 * Theme the app falls back to when there is no explicit choice.
 *
 * "system" follows the OS preference (next-themes resolves it to light or
 * dark); when the OS states no preference, `prefers-color-scheme` resolves to
 * light, so an unconfigured visitor sees the light theme. The bootstrap script
 * in public/index.html implements the same fallback.
 */
export const DEFAULT_THEME = "system";

/**
 * The theme forced when ENABLE_LIGHT_MODE is off. Kept as its own constant
 * because DEFAULT_THEME is now "system", which is not a value `forcedTheme`
 * can resolve to a concrete colour scheme.
 */
const DARK_ONLY_THEME = "dark";

/**
 * Master switch for the light theme. While false the app is dark-only and
 * ThemeToggle renders nothing; true (Part 5 onwards) ships both themes.
 */
export const ENABLE_LIGHT_MODE = true;

/**
 * `<meta name="theme-color">` values, updated at runtime from App.js.
 *
 * These are the only sanctioned hex literals in src/: the meta tag is read by
 * the browser chrome and cannot resolve a CSS custom property, so the literal
 * has to exist somewhere. They mirror --c-canvas in src/index.css — if a token
 * changes, change it here too.
 */
export const THEME_COLOR_META = {
  light: "#FFFBE9",
  dark: "#0D0D0D",
};

const VALID_THEMES = ["light", "dark"];

const isBrowser = () => typeof window !== "undefined";

const isValidTheme = (value) => VALID_THEMES.indexOf(value) !== -1;

/**
 * Reads the tab-scoped preview override, persisting a freshly supplied
 * `?previewTheme=` value to sessionStorage so it survives client-side
 * navigation within the tab.
 *
 * Returns "light" | "dark" | null. Safe when storage is blocked (private
 * mode, sandboxed iframe) — it simply degrades to "no override".
 */
export function readPreviewTheme() {
  if (!isBrowser()) return null;

  try {
    const fromUrl = new URLSearchParams(window.location.search).get(PREVIEW_THEME_PARAM);
    if (isValidTheme(fromUrl)) {
      try {
        window.sessionStorage.setItem(PREVIEW_THEME_SESSION_KEY, fromUrl);
      } catch (writeError) {
        /* storage unavailable — the URL value still applies for this render */
      }
      return fromUrl;
    }

    const fromSession = window.sessionStorage.getItem(PREVIEW_THEME_SESSION_KEY);
    return isValidTheme(fromSession) ? fromSession : null;
  } catch (readError) {
    return null;
  }
}

/**
 * The value to hand to next-themes' `forcedTheme`.
 *
 * - `?previewTheme=` (or a value it stored earlier in this tab) always wins, so
 *   a reviewer can force a theme without disturbing the stored choice.
 * - Otherwise, with ENABLE_LIGHT_MODE on, nothing is forced: the visitor's
 *   explicit choice, or their system preference, decides. Returns undefined.
 * - With the flag off (escape hatch) the tab is forced dark-only.
 */
export function resolveForcedTheme() {
  if (!isBrowser()) return undefined;

  const preview = readPreviewTheme();
  if (preview) return preview;

  return ENABLE_LIGHT_MODE ? undefined : DARK_ONLY_THEME;
}
