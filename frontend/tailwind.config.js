/** @type {import('tailwindcss').Config} */

// ---------------------------------------------------------------------------
// Clann design tokens (see DESIGN_SYSTEM.md, section R2).
//
// Every colour is stored in src/index.css as raw RGB channels on a --c-*
// custom property, and exposed here as `rgb(var(--c-*) / <alpha-value>)` so
// Tailwind opacity utilities (bg-scrim/60, border-line/40, ...) keep working.
//
// Naming rules (R2):
//   * the canvas token is called `canvas` — never `base`
//   * the design tokens never reuse the names `accent`, `primary` or `border`
//   * the shadcn aliases at the bottom of the colour map DO keep those names,
//     purely so every existing ui/* component follows the theme unchanged.
// ---------------------------------------------------------------------------

const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    // Test files are deliberately excluded from the JIT content scan.
    // src/design-system.guardrail.test.js has to quote banned class names
    // (bg-white, rounded-2xl, tracking-widest, text-red-500 ...) in order to
    // assert the guardrail catches them, and Tailwind would otherwise emit
    // every one of those utilities into the production CSS bundle. The
    // guardrail exempts test files for the same reason, so the two exemptions
    // must stay in step.
    "!./src/**/*.test.{js,jsx,ts,tsx}",
    "!./src/**/*.spec.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Satoshi', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      // R5 — shape. rounded-sm 8px, rounded-md 12px, rounded-lg 16px.
      // `rounded-full` stays as the Tailwind default (buttons, chips, avatars).
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px'
      },
      // R5 — elevation. Both resolve to `none` in dark mode (see index.css),
      // where elevated surfaces use bg-raised plus a border instead.
      boxShadow: {
        'elev-1': 'var(--shadow-1)',
        'elev-2': 'var(--shadow-2)'
      },
      // Tailwind's preflight defaults `border-color` to gray-200, which would
      // leave every bare `border` / `border-b` / `divide-y` light grey in BOTH
      // themes. Point the defaults at the line token so a bare border is
      // automatically themed (R1: surfaces are separated by borders; R2:
      // border=line).
      borderColor: {
        DEFAULT: token('line')
      },
      divideColor: {
        DEFAULT: token('line')
      },
      // R5 — motion.
      transitionDuration: {
        fast: '150ms',
        standard: '250ms',
        slow: '350ms'
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.4, 0, 0.2, 1)'
      },
      colors: {
        // --- Design tokens (R2) -------------------------------------------
        canvas: token('canvas'),
        surface: token('surface'),
        raised: token('raised'),
        brand: token('brand'),
        chip: token('chip'),
        selected: token('selected'),
        'on-selected': token('on-selected'),
        line: token('line'),
        'line-input': token('line-input'),
        ink: token('ink'),
        'ink-2': token('ink-2'),
        'ink-muted': token('ink-muted'),
        'ink-disabled': token('ink-disabled'),
        cta: token('cta'),
        'cta-hover': token('cta-hover'),
        'on-cta': token('on-cta'),
        'cta-text': token('cta-text'),
        focus: token('focus'),
        danger: token('danger'),
        'danger-bg': token('danger-bg'),
        ok: token('ok'),
        'ok-bg': token('ok-bg'),
        scrim: token('scrim'),

        // --- shadcn/ui aliases (R2 mapping) -------------------------------
        // background=canvas, foreground=ink, card=surface, popover=surface,
        // primary=cta, secondary=raised, muted=raised, accent=raised,
        // destructive=danger, border=line, input=line-input, ring=focus.
        background: token('canvas'),
        foreground: token('ink'),
        card: {
          DEFAULT: token('surface'),
          foreground: token('ink')
        },
        popover: {
          DEFAULT: token('surface'),
          foreground: token('ink')
        },
        primary: {
          DEFAULT: token('cta'),
          foreground: token('on-cta')
        },
        secondary: {
          DEFAULT: token('raised'),
          foreground: token('ink')
        },
        muted: {
          DEFAULT: token('raised'),
          foreground: token('ink-muted')
        },
        accent: {
          DEFAULT: token('raised'),
          foreground: token('ink')
        },
        destructive: {
          DEFAULT: token('danger'),
          foreground: token('canvas')
        },
        border: token('line'),
        input: token('line-input'),
        ring: token('focus'),
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))'
        }
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0'
          },
          to: {
            height: 'var(--radix-accordion-content-height)'
          }
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)'
          },
          to: {
            height: '0'
          }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
};
