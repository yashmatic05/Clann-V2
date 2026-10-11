import React, { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTheme } from "next-themes";
import { ENABLE_LIGHT_MODE } from "@/lib/theme";

/**
 * Theme switch — DESIGN_SYSTEM.md Part 1c / R8 "Icons".
 *
 * Circular 44x44 icon button on surface with a line border; hover fills with
 * `raised`. No orange, no shadow, no blur. The icon names the DESTINATION:
 * dark mode shows a Sun (click -> light), light mode shows a Moon
 * (click -> dark). The swap is a 250ms opacity+rotate crossfade, with the
 * rotation dropped and the duration set to 0 under prefers-reduced-motion.
 *
 * ENABLE_LIGHT_MODE (src/lib/theme.js) is the master switch: while it is false
 * this component renders nothing and the app is dark-only. It is true from
 * Part 5 onwards, so the switch ships to visitors.
 */

// R5 motion contract: 250ms, standard easing.
const CROSSFADE_TRANSITION = { duration: 0.25, ease: [0.4, 0, 0.2, 1] };
const NO_MOTION_TRANSITION = { duration: 0 };

/**
 * The theme the bootstrap script in public/index.html already applied to <html>
 * before React ran. Used for the pre-mount render so the icon shown on the very
 * first paint is already the right one: AnimatePresence has `initial={false}`,
 * so the first icon appears at full opacity, and guessing "dark" here made
 * every light-theme visitor watch a Sun crossfade into a Moon on page load.
 */
const bootstrapSaysDark = () =>
  typeof document !== "undefined" &&
  document.documentElement.classList.contains("dark");

const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Feature flag is a module constant, so this early return is stable across
  // renders and every hook above has already run.
  if (!ENABLE_LIGHT_MODE) return null;

  // Before mount next-themes has not resolved yet, so trust the bootstrap.
  const isDark = mounted ? resolvedTheme !== "light" : bootstrapSaysDark();
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";
  const reducedMotion = prefersReducedMotion === true;
  const transition = reducedMotion ? NO_MOTION_TRANSITION : CROSSFADE_TRANSITION;

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors duration-standard ease-standard hover:bg-raised"
    >
      <span className="relative flex h-5 w-5 items-center justify-center">
        <AnimatePresence initial={false}>
          <motion.span
            key={isDark ? "sun" : "moon"}
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0, rotate: reducedMotion ? 0 : -90 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: reducedMotion ? 0 : 90 }}
            transition={transition}
          >
            {isDark ? (
              <Sun size={20} strokeWidth={1.75} />
            ) : (
              <Moon size={20} strokeWidth={1.75} />
            )}
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
  );
};

export default ThemeToggle;
