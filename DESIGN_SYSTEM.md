# CLANN DESIGN SYSTEM ROLLOUT (light and dark themes)

Source of truth for every UI change in this repository. Read this before touching
any component, page or style file.

=====================================================================
REFERENCE (source of truth)
=====================================================================

R1. RULES THAT NEVER CHANGE
- Flat and minimal. NO glassmorphism: no backdrop blur, frosted or translucent panels, glows, gradients, 3D or glass icons, grain or noise overlays, decorative shadows. Surfaces are separated by borders and spacing.
- 60-30-10: 60% neutral base, 30% structural tone, 10% orange reserved for the most important action.
- Orange is NEVER used for navbar backgrounds, headings, header text, tab bars, filters, icon-button hovers or large areas.
- One primary (orange) action per card and per screen.
- Every button says what happens (see R8 copy table). No Submit, Click Here, Learn More.
- Every padding, margin and gap is a multiple of 4 from the allowed scale in R6.
- One icon library (lucide-react), one stroke weight, universally recognised symbols. No emoji in interface chrome.
- WCAG AA: 4.5:1 for text, 3:1 for borders and controls. Never pale grey text on light backgrounds.
- Light and dark share ONE layout. Only token values change. Components never contain hex codes.

R2. COLOR TOKENS (RGB channels, so opacity utilities keep working)
Define in src/index.css: `:root, .light { ... }` holds the light values, and `.dark { ... }` holds the dark values. Both selectors are needed so a `.light` element nested inside a `.dark` page resets to light (used by the style guide).

    DESIGN TOKEN     CSS VARIABLE        TAILWIND NAME  LIGHT                      DARK
    bg-base          --c-canvas          canvas         255 251 233  #FFFBE9       13 13 13     #0D0D0D
    bg-surface       --c-surface         surface        255 255 255  #FFFFFF       23 18 31     #17121F
    bg-raised        --c-raised          raised         241 236 245  #F1ECF5       33 26 44     #211A2C
    bg-brand         --c-brand           brand          40 0 73      #280049       40 0 73      #280049
    bg-chip          --c-chip            chip           195 182 210  #C3B6D2       33 26 44     #211A2C
    bg-selected      --c-selected        selected       40 0 73      #280049       195 182 210  #C3B6D2
    on-selected      --c-on-selected     on-selected    255 251 233  #FFFBE9       40 0 73      #280049
    border-default   --c-line            line           217 207 227  #D9CFE3       59 48 80     #3B3050
    border-input     --c-line-input      line-input     124 106 146  #7C6A92       124 106 146  #7C6A92
    text-primary     --c-ink             ink            40 0 73      #280049       255 251 233  #FFFBE9
    text-secondary   --c-ink-2           ink-2          94 74 117    #5E4A75       195 182 210  #C3B6D2
    text-muted       --c-ink-muted       ink-muted      107 90 128   #6B5A80       154 140 173  #9A8CAD
    text-disabled    --c-ink-disabled    ink-disabled   154 140 173  #9A8CAD       107 90 128   #6B5A80
    accent           --c-cta             cta            248 78 0     #F84E00       248 78 0     #F84E00
    accent-hover     --c-cta-hover       cta-hover      255 106 43   #FF6A2B       255 106 43   #FF6A2B
    on-accent        --c-on-cta          on-cta         40 0 73      #280049       40 0 73      #280049
    accent-text      --c-cta-text        cta-text       198 62 0     #C63E00       248 78 0     #F84E00
    focus-ring       --c-focus           focus          40 0 73      #280049       195 182 210  #C3B6D2
    error            --c-danger          danger         179 20 27    #B3141B       255 138 128  #FF8A80
    error-bg         --c-danger-bg       danger-bg      253 236 234  #FDECEA       42 18 20     #2A1214
    success          --c-ok              ok             27 107 67    #1B6B43       111 211 160  #6FD3A0
    success-bg       --c-ok-bg           ok-bg          230 244 236  #E6F4EC       23 18 31     #17121F
    scrim            --c-scrim           scrim          13 13 13  (use /60)        0 0 0  (use /70)

Tailwind config: each color is `'rgb(var(--c-xxx) / <alpha-value>)'`. The Tailwind name `canvas` is deliberate: do NOT name anything `base` or reuse the names `accent`, `primary`, `border`. Also define two box shadows as CSS variables, `--shadow-1` (light: `0 4px 12px rgba(40,0,73,0.10)`, dark: `none`) and `--shadow-2` (light: `0 12px 32px rgba(40,0,73,0.16)`, dark: `none`), exposed as `shadow-elev-1` and `shadow-elev-2`.

Map the existing shadcn color names in tailwind.config.js onto these tokens so every ui/* component follows the theme: background=canvas, foreground=ink, card=surface, card-foreground=ink, popover=surface, popover-foreground=ink, primary=cta, primary-foreground=on-cta, secondary=raised, secondary-foreground=ink, muted=raised, muted-foreground=ink-muted, accent=raised, accent-foreground=ink, destructive=danger, destructive-foreground=canvas, border=line, input=line-input, ring=focus. Remove the old HSL variables from index.css (leave chart colors untouched if present).

Contrast rules (all verified): light purple (chip) is never text on the light theme (1.85:1). White text on orange fails (3.45:1), so labels on orange are ALWAYS `text-on-cta` (indigo, 5.13:1). Orange text smaller than 18px uses `text-cta-text`. Error red must never be used for orange-ish emphasis, and destructive buttons use a red outline, never orange. Color never carries meaning alone: errors and statuses always have an icon and words. There is no warning/amber color.

R3. TYPOGRAPHY (Satoshi, already loaded; use weights 400, 500, 700; 900 only for Display)
Add these classes in `@layer components` in index.css. Breakpoint for "desktop" is md (768px).

    .t-display      32/40 -> 48/56   weight 900  letter-spacing -0.02em   (Home hero heading only)
    .t-h1           28/36 -> 32/40   weight 700
    .t-h2           22/28 -> 24/32   weight 700
    .t-h3           18/24            weight 700
    .t-body-lg      16/24            weight 400
    .t-body         14/20            weight 400
    .t-body-strong  14/20            weight 500
    .t-label        12/16            weight 500   sentence case
    .t-caption      12/16            weight 400
    .t-button       14/20            weight 700   (16/24 for lg buttons)

No `text-[..px]` anywhere. Minimum text size is 12px (this replaces every text-[10px] and text-[11px]). Replace all `uppercase tracking-widest` labels with .t-label in sentence case. Uppercase is allowed only for badge text of 3 words or fewer. `font-black` is allowed only inside .t-display. Description line length stays between 45 and 75 characters.

R4. HEX AND CLASS MIGRATION RULES (the same old color maps to different tokens depending on use)

    #0D0D0D                              -> bg-canvas (solid, never with an alpha like /85)
    #18002C                              -> bg-surface
    #280049 as card-in-card, tab list, hover fill, scrollbar thumb -> bg-raised
    #280049 as footer or strong block    -> bg-brand
    #46176D and #46176D/NN (borders)     -> border-line
    #46176D on input borders             -> border-line-input
    #46176D as avatar placeholder fill   -> bg-chip
    #BF72FF as label, icon, secondary text -> text-ink-2
    #BF72FF as an actual link            -> text-cta-text hover:underline
    #727272                              -> text-ink-muted
    #FFFFFF, #FFFBE9, text-white on surfaces -> text-ink
    white text on orange                 -> text-on-cta
    #F84E00 as button or badge fill      -> bg-cta
    #F84E00 as small text or icon        -> text-cta-text
    #F84E00 as hover fill on icon buttons, active tabs, active filters -> NOT orange: hover:bg-raised, and bg-selected text-on-selected for active/selected
    #F84E00 as border or outline         -> border-line-input or the global focus ring
    #D14200, #C63E00 (orange hover/active) -> hover:bg-cta-hover plus active:scale-[0.98]
    bg-black/50, bg-black/70 (overlays)  -> bg-scrim/60 with no blur
    Tailwind palette classes (text-red-*, bg-emerald-*, border-amber-*, etc.) -> danger / danger-bg / ok / ok-bg tokens. Amber "pending" becomes neutral bg-raised with a clock icon.
    rgba() and hex inside style props, SVG fills and toast options -> tokens via `rgb(var(--c-xxx))` or currentColor.
    Exception (allowlist): official third-party brand marks (the WhatsApp icon colors, the Google "G" logo) keep their official colors. List each one in a comment at the top of the file.

R5. SHAPE, ELEVATION, MOTION, LAYERS
- Radius: override Tailwind so `rounded-sm`=8px, `rounded-md`=12px, `rounded-lg`=16px, plus `rounded-full`. Buttons, chips and avatars use rounded-full. Inputs, banners and card images use rounded-md. Cards and modals use rounded-lg. Replace rounded-xl, rounded-2xl, rounded-3xl and rounded-[..] with these.
- Borders are 1px. Focus outline is 2px with 2px offset.
- Elevation: cards, inputs and buttons have NO shadow (remove every shadow-sm, shadow-md, shadow-lg and arbitrary shadow, including inside ui/*). Use `shadow-elev-1` for dropdown, popover, select, menu and hover-card content, and `shadow-elev-2` for dialog, alert-dialog and sheet. In dark mode these resolve to none, so those surfaces use bg-raised plus a border.
- Motion: add Tailwind `duration-fast` 150ms, `duration-standard` 250ms, `duration-slow` 350ms, and `ease-standard` = cubic-bezier(0.4,0,0.2,1). Use `transition-colors`, `transition-opacity` or `transition-transform` only (never `transition-all`). Cards do not lift or scale on hover (remove hover:-translate-y and hover:scale); hover changes the border color to border-line-input. Existing framer-motion transitions use `{ duration: 0.25 or 0.35, ease: [0.4, 0, 0.2, 1] }` and respect `useReducedMotion()` (duration 0 when reduced). Add a global `@media (prefers-reduced-motion: reduce)` rule that removes transitions and animations.
- Z-index: navbar, admin header, bottom tab bar and sticky mobile register bar z-20; dropdown, popover, select z-30; scrim z-40; dialog, alert-dialog, sheet z-50.

R6. SPACING AND LAYOUT
Allowed spacing utilities for padding, margin, gap and space-x/y: 0, 1, 2, 3, 4, 6, 8, 12, 16 (that is 0, 4, 8, 12, 16, 24, 32, 48, 64px) plus `px`. FORBIDDEN: 0.5, 1.5, 2.5, 3.5, 5, 7, 9, 10, 11, 14, 20, 24 and any arbitrary `p-[..px]`, `m-[..px]`, `gap-[..px]`. One exception: `pb-20 md:pb-0` is allowed on page containers to clear the mobile bottom tab bar. Widths and heights may be Tailwind defaults or arbitrary values only if they are multiples of 4. Breakpoints: sm 640, md 768, lg 1024, xl 1280. Max content width 1280. Page gutters 16 / 24 (sm) / 32 (lg). Event grid: 1 column on mobile, 2 from md, 3 from lg, 4 from xl. Every tap target is at least 44x44. Section spacing 32 on mobile and 48 on desktop. Title to content 16. Card padding 16 (24 from lg). Gap between cards 16.

R7. GLOBAL CSS (index.css)
html, body, #root: `background-color: rgb(var(--c-canvas)); color: rgb(var(--c-ink))` (no hex). `body { @apply bg-canvas text-ink }`. Selection: `background: rgb(var(--c-selected)); color: rgb(var(--c-on-selected))`. Scrollbar: track canvas, thumb line-input, thumb hover ink-2. Global `:focus-visible { outline: 2px solid rgb(var(--c-focus)); outline-offset: 2px }` replacing the orange focus rule. Remove the unused `.grain` rule. `.footer-caret` uses ink instead of orange. Keep line-clamp helpers and `.no-scrollbar`/`.scrollbar-hide`.

R8. COMPONENTS

Buttons. Rebuild `buttonVariants` in src/components/ui/button.jsx and use it for EVERY button-like element (including `<Link>` and `<a>` styled as buttons), replacing ad-hoc class strings. All are pill-shaped, bold, `t-button`.
    variants:  primary      bg-cta text-on-cta hover:bg-cta-hover
               secondary    border border-line-input bg-transparent text-ink hover:bg-raised
               tertiary     bg-transparent text-ink hover:underline
               destructive  border border-danger bg-transparent text-danger hover:bg-danger-bg (always followed by a confirm dialog)
               link         text-cta-text hover:underline, h-auto p-0
    sizes:     sm h-9 px-4 | md (default) h-11 px-6 | lg h-[52px] px-8 text-base | icon h-11 w-11 p-0 (needs aria-label)
    states:    active -> scale-[0.98]; disabled -> bg-raised text-ink-disabled, pointer-events-none (never opacity alone); loading prop -> 16px Loader2 spinner replaces the icon, label stays, width fixed, button disabled.
Never place two primary buttons together. On cards: Register is primary, "View details" is secondary.

CTA copy (change only these; do not touch aria-labels or test ids)
    Register (on EventDetail, both in-page and sticky bar)  -> "Register on {platform}" using a new helper `registrationPlatformName(url)` in src/lib/event-utils.js (known hosts: unstop, devfolio, lu.ma/luma, eventbrite, meetup, townscript, allevents, district, commudle, hack2skill, insider; anything else -> "Register now")
    Register (on narrow cards)               -> stays "Register"
    Know More                                -> "View details"
    Submit Your Event / any "submit your event" CTA -> "List your event"
    Organizer form submit                    -> "Send for review"
    Check Status                             -> "Check my submission"
    Save Note                                -> "Save note for organizer"
    Sign In / Sign Up (Navbar)               -> "Sign in"
    + Submit Another Event                   -> "List another event"
    Approve / Reject (admin)                 -> "Approve and publish" / "Reject with reason"
Any other generic label (Submit, Learn more, Click here) -> a verb plus the object.

Inputs. Create src/components/ui/form-field.jsx (label, optional hint, error) and update ui/input, textarea and select to: h-11 (textarea min-h-24), px-4, py-3 for textarea, rounded-md, `border border-line-input bg-surface text-ink placeholder:text-ink-muted`, text-base on mobile and text-sm from md (prevents iOS zoom), `hover:border-ink-2`, `focus-visible:border-ink`, `aria-[invalid=true]:border-danger`, `disabled:bg-raised disabled:text-ink-disabled`. Label above the field in .t-label text-ink-2 (required fields end with " *"). Hint in .t-caption text-ink-muted. Error = 16px AlertCircle icon plus message in .t-caption text-danger below the field, with aria-invalid and aria-describedby wired. Validate on blur and on submit; the error clears while typing. Checkbox, radio and switch are on-state `bg-selected`, never orange, with a 44px tap area. Replace the local `Field` components and inputCls strings in OrganizerSubmit.jsx, AdminPanel.jsx, CompleteProfile.jsx, Auth.jsx and AdminLogin.jsx with FormField and the shared input classes, keeping every data-testid and all validation logic.

Event cards (EventCard, CompactEventCard, and the RelatedEventCard in EventDetail.jsx and EventsListPage.jsx): `bg-surface border border-line rounded-lg`, padding 16, no shadow, no hover lift. Spacing inside: 8 between related lines, 12 between groups. Title uses .t-h3 (2 lines max); description .t-body (2 lines max); meta .t-caption text-ink-2. Image area 16:9, rounded-md. Keep the current structure and ordering and all data-testids; if the inset image would need more than class-level edits, keep the full-bleed image and apply only the tokens, radius and spacing, and tell me what you kept. Register button pinned to the card bottom so all cards align. Image-overlay icon buttons (share, save) become solid: `bg-surface border border-line text-ink`, hover `bg-raised`, saved state `bg-selected text-on-selected` (no blur, no translucency, no orange). Remove every gradient scrim over images; if text sits on an image, move it into a solid bg-surface block beside or below the image. Do NOT change how the image src is chosen.

Chips, badges, tabs. Category chip: rounded-full, h-9, px-4, `bg-chip text-ink` (dark: text-ink-2); selected chip or tab: `bg-selected text-on-selected` (keep the existing framer-motion sliding indicator, recolored). ui/tabs: list `bg-raised rounded-full p-1 h-auto`, trigger `rounded-full px-4 min-h-9 text-ink-2 data-[state=active]:bg-selected data-[state=active]:text-on-selected`; delete the per-usage orange overrides. Neutral badge: rounded-full, h-6, px-2, .t-caption weight 500, bg-chip (category, mode, price). Urgent badge: bg-cta text-on-cta, max one per card, for "Closing soon" only. Status badges always show icon plus word: Pending (Clock, bg-raised text-ink), Approved (Check, bg-ok-bg text-ok), Rejected (X, bg-danger-bg text-danger).

Navigation. Navbar: h-16, `bg-canvas border-b border-line`, no blur, no translucency; the only orange element is the Sign in button; icon buttons are h-11 w-11 rounded-full with hover:bg-raised. Bottom tab bar: `bg-surface border-t border-line`, no blur; active item text-ink with a 2px indicator in bg-selected; inactive text-ink-muted; never orange. Footer: light theme `bg-brand` with cream text (text-canvas) and the monuments illustration; dark theme `dark:bg-canvas dark:text-ink dark:border-t dark:border-line`; remove the gradient fade and the drop-shadow glow on the logo; keep the orange logo (/brand/clann-logo-color.png); copyright and links on one horizontal row (this was already requested) with 24px above the bottom edge.

Feedback and states. Loading lists: skeletons in bg-raised matching the final layout (no spinners). Empty state: 32px line icon, .t-h3 title, one .t-body text-ink-2 sentence, one secondary button when there is a next step. Inline error: `bg-danger-bg border border-danger rounded-md p-4`, 16px icon, plain sentence, secondary Retry button. Success toast (sonner): `bg-surface text-ink border border-line shadow-none`, success icon, 4 seconds. Slow server: if an API call is still pending after 3 seconds show "Waking up the server, this can take up to 30 seconds" in the loading state (never a blank screen). Modal/dialog: `bg-surface rounded-lg p-6 shadow-elev-2`, scrim `bg-scrim/60` with no blur, focus trap and Esc to close.

Icons. lucide-react only, strokeWidth 1.75, sizes 16, 20, 24, color inherits (currentColor).

R9. BANNED (must not appear anywhere in src after Part 5): `backdrop-blur`, `bg-gradient`, `from-[`, `via-[`, `to-[`, `blur-`, `drop-shadow`, `shadow-sm|md|lg|xl|2xl`, `shadow-[`, `bg-black`, `text-black`, `bg-white`, `text-white`, `border-white`, Tailwind palette color classes (red, green, emerald, amber, yellow, orange, purple, violet, slate, gray, zinc, neutral, stone, blue, pink and so on), hex codes in components or pages, `tracking-widest`, `font-black` outside .t-display, `text-[Npx]`, `rounded-xl|2xl|3xl`, `rounded-[`, `transition-all`, `hover:-translate`, `hover:scale`, `mix-blend`, `.grain`, translucent panel backgrounds such as `bg-xxx/85`.

---

## GUARDRAIL (Part 5) — how R4, R6 and R9 are actually enforced

R9 says the banned patterns "must not appear anywhere in src after Part 5". From Part 5 that is
checked by a script instead of by memory or by hand-written greps:

    cd frontend
    npm run lint:design          # human-readable report; exit 1 on any violation
    npm run lint:design:json     # machine-readable, for CI annotations
    npm test                     # runs the same scan over the real src/ and fails on a violation

`frontend/scripts/check-design-system.js` is dependency-free plain Node — it imports nothing from
node_modules — so it can run in CI before an install, from a pre-commit hook, or standalone. It
scans every `.js`, `.jsx` and `.css` file under `src/` against nine rule groups and reports matches,
allowlisted matches and violations per group:

| group         | what it catches                                                          |
|---------------|--------------------------------------------------------------------------|
| `hex`         | any 3/4/6/8-digit hex literal in a component or page (R4)                 |
| `rgb-literal` | numeric `rgb()` / `rgba()` instead of `rgb(var(--c-token))` (R4)          |
| `r9`          | the R9 banned list: blur, gradients, Tailwind shadow sizes, `bg-white`,   |
|               | `tracking-widest`, `font-black`, oversized/arbitrary radius,              |
|               | `transition-all`, hover lift, `mix-blend`                                 |
| `palette`     | Tailwind palette classes with a shade number, e.g. `text-red-500` (R9)    |
| `spacing`     | p/m/gap/space off R6's scale (0 1 2 3 4 6 8 12 16 px)                     |
| `grid-step`   | `.5` steps and arbitrary h/w that are not multiples of 4 (R6)             |
| `text-px`     | `text-[Npx]` instead of the `.t-*` type scale (R3/R9)                     |
| `panel-alpha` | translucent PANEL backgrounds such as `bg-surface/85` (R9)                |
| `css`         | `tracking-widest`, `font-black`, `backdrop-filter`, `.grain` in CSS       |

State as of Part 5: **15 matches, all allowlisted, 0 violations.**

### The allowlist

`frontend/design-system.allowlist.json` is the machine-readable list of sanctioned exceptions. Each
entry names a file, a rule group and the exact values permitted there, and carries a written `reason`
plus a `review` note. It is deliberately hard to abuse:

* the guardrail **fails** if a file contains a value that is not listed, so an entry cannot be
  broadened into a wildcard;
* the guardrail **reports stale entries** (`--strict` turns that into a failure), so an exception
  cannot outlive the code it excused;
* an entry without a `reason` of at least some substance is rejected at load time.

Four entries exist. Three are the R4 brand-and-meta exceptions and are permanent:
`src/lib/theme.js` (the two `<meta name="theme-color">` values, which cannot resolve a CSS custom
property), `src/components/WhatsAppIcon.jsx` and `src/pages/Auth.jsx` (the official WhatsApp and
Google "G" brand marks). The fourth — `bg-canvas/50` and `bg-canvas/80` on the hero carousel's 8px
dot indicator — is recorded as an **open item, not a sanctioned exception**; see below.

### What the guardrail deliberately does NOT flag

These boundaries are recorded here so the tool is auditable rather than mysterious. The same text
lives in `$ruleBoundaries` inside the allowlist file.

* **Comments and test files.** Both are stripped/skipped before matching, so documentation and tests
  may quote a banned pattern. This matters in practice: `ui/switch.jsx`'s own doc comment quotes
  `data-[state=checked]:bg-cta` while explaining what call sites must NOT do, and a plain grep
  reports that as a violation.
* **Token-alpha tints.** `bg-scrim/60` (the sanctioned overlay), `bg-cta/15` + `border-cta/50` (the
  paid-price badge), and shadcn's `bg-muted/50` / `bg-accent/50` / `bg-primary/20` are tint fills on
  small elements, not panels. `panel-alpha` therefore only covers canvas, surface, raised, brand,
  card, popover and background.
* **`active:scale-[0.98]`.** R4 sanctions it as press feedback; only `hover:scale` and
  `hover:-translate` are the banned lift.
* **Sub-8px arbitrary sizes.** `h-[2px]` is R8's active-tab indicator, so `grid-step` exempts
  hairlines below 8px while still rejecting anything larger that is not a multiple of 4.
* **`pb-20 md:pb-0`**, R6's one documented spacing exception for clearing the mobile tab bar.
* **`src/index.css` hex values.** That file is where the `--c-*` tokens are *defined*, so it is
  exempt from the `hex` group and covered by the `css` group instead.

### Part 5 status: light mode is LIVE

`ENABLE_LIGHT_MODE` in `src/lib/theme.js` and `LIGHT_ENABLED` in the inline bootstrap in
`public/index.html` are both `true`, and `DEFAULT_THEME` is `"system"`. Visitors get their OS
preference (light when the OS states none) and can override it with the ThemeToggle in the Navbar, or
the one pinned to the viewport on Auth, AdminLogin and CompleteProfile. `?previewTheme=light|dark`
still forces a theme for the current tab and beats a stored choice — it was going to be deleted with
the flip but was kept because it remains the only way to force a theme for screenshots and QA.

A test in `src/lib/theme.test.js` asserts that the two flags agree and that the storage keys match,
so they cannot drift apart again. Flipping `ENABLE_LIGHT_MODE` back to `false` is the supported
escape hatch and is covered by tests (it forces dark-only everywhere while leaving `?previewTheme`
working).

### Open items

* `src/components/HeroBanner.jsx:115` — the carousel's inactive dot uses `bg-canvas/50` with a
  `hover:bg-canvas/80`. The only canvas-alpha fills in `src`. They are on an 8px dot rather than a
  panel, so they are outside the spirit of R9, but making them opaque would clear the allowlist
  entry.
* There is still no `warning` / amber token. Amber states were mapped to a neutral
  `bg-raised text-ink-2` in Parts 2-4 while keeping their wording (R2), so a genuine warning tone
  cannot be expressed yet.
* `ui/switch.jsx` carries a stale comment claiming AdminPanel still overrides the switch on-state.
  Part 4 removed those overrides and `src/components/ui/switch.test.js` now asserts none exist
  anywhere, so the comment is simply out of date.
* `FormField` around a Radix `Select` leaves the `<label for>` dangling, because `Select.Root`
  renders no DOM node to receive the cloned `id`. Recorded as a known gap in
  `src/components/ui/form-field.test.js`.
