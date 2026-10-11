import React, { useMemo } from "react";
import { AlertCircle, Check, Clock, Loader2, Search, Settings2, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import EventCard from "@/components/EventCard";
import ThemedLogo from "@/components/ThemedLogo";
import { assignEventImages } from "@/lib/image-fallback";
import { cn } from "@/lib/utils";

/**
 * Clann design-system style guide — DESIGN_SYSTEM.md Part 1e.
 *
 * Route: /design-system. Deliberately NOT linked from anywhere in the product.
 *
 * Both themes are rendered side by side on one page: the left panel carries
 * `className="light"` and the right `className="dark"`. Because src/index.css
 * declares the tokens on `:root, .light` AND on `.dark`, each panel resets the
 * custom properties for its own subtree regardless of which theme <html> is
 * currently in. That is also why this page contains no `dark:` variants — every
 * colour is a plain token utility that resolves from the enclosing panel.
 *
 * Everything here is built from tokens and the shared components only: no hex
 * codes, no arbitrary text sizes, no off-grid spacing.
 */

/* -------------------------------------------------------------------------- */
/* Reference data                                                             */
/* -------------------------------------------------------------------------- */

// R2 — the full token table. `swatch` / `text` are literal class strings so
// Tailwind's scanner can see them.
const COLOR_TOKENS = [
  { token: "bg-base", tailwind: "canvas", cssVar: "--c-canvas", swatch: "bg-canvas" },
  { token: "bg-surface", tailwind: "surface", cssVar: "--c-surface", swatch: "bg-surface" },
  { token: "bg-raised", tailwind: "raised", cssVar: "--c-raised", swatch: "bg-raised" },
  { token: "bg-brand", tailwind: "brand", cssVar: "--c-brand", swatch: "bg-brand" },
  { token: "bg-chip", tailwind: "chip", cssVar: "--c-chip", swatch: "bg-chip" },
  { token: "bg-selected", tailwind: "selected", cssVar: "--c-selected", swatch: "bg-selected" },
  { token: "on-selected", tailwind: "on-selected", cssVar: "--c-on-selected", swatch: "bg-on-selected" },
  { token: "border-default", tailwind: "line", cssVar: "--c-line", swatch: "bg-line" },
  { token: "border-input", tailwind: "line-input", cssVar: "--c-line-input", swatch: "bg-line-input" },
  { token: "text-primary", tailwind: "ink", cssVar: "--c-ink", swatch: "bg-ink" },
  { token: "text-secondary", tailwind: "ink-2", cssVar: "--c-ink-2", swatch: "bg-ink-2" },
  { token: "text-muted", tailwind: "ink-muted", cssVar: "--c-ink-muted", swatch: "bg-ink-muted" },
  { token: "text-disabled", tailwind: "ink-disabled", cssVar: "--c-ink-disabled", swatch: "bg-ink-disabled" },
  { token: "accent", tailwind: "cta", cssVar: "--c-cta", swatch: "bg-cta" },
  { token: "accent-hover", tailwind: "cta-hover", cssVar: "--c-cta-hover", swatch: "bg-cta-hover" },
  { token: "on-accent", tailwind: "on-cta", cssVar: "--c-on-cta", swatch: "bg-on-cta" },
  { token: "accent-text", tailwind: "cta-text", cssVar: "--c-cta-text", swatch: "bg-cta-text" },
  { token: "focus-ring", tailwind: "focus", cssVar: "--c-focus", swatch: "bg-focus" },
  { token: "error", tailwind: "danger", cssVar: "--c-danger", swatch: "bg-danger" },
  { token: "error-bg", tailwind: "danger-bg", cssVar: "--c-danger-bg", swatch: "bg-danger-bg" },
  { token: "success", tailwind: "ok", cssVar: "--c-ok", swatch: "bg-ok" },
  { token: "success-bg", tailwind: "ok-bg", cssVar: "--c-ok-bg", swatch: "bg-ok-bg" },
  { token: "scrim", tailwind: "scrim", cssVar: "--c-scrim", swatch: "bg-scrim/60" },
];

// R2 — text tokens shown as real type on a surface, which is how they are used.
const TEXT_TOKENS = [
  { tailwind: "text-ink", note: "Primary text. Headings, body, values.", className: "text-ink" },
  { tailwind: "text-ink-2", note: "Secondary text. Meta, labels, descriptions.", className: "text-ink-2" },
  { tailwind: "text-ink-muted", note: "Muted text. Hints, timestamps, placeholders.", className: "text-ink-muted" },
  { tailwind: "text-ink-disabled", note: "Disabled text only — never for readable copy.", className: "text-ink-disabled" },
  { tailwind: "text-cta-text", note: "Orange text under 18px. Links, emphasis.", className: "text-cta-text" },
  { tailwind: "text-danger", note: "Errors. Always paired with an icon and words.", className: "text-danger" },
  { tailwind: "text-ok", note: "Success. Always paired with an icon and words.", className: "text-ok" },
];

// R3 — the type scale.
const TYPE_CLASSES = [
  { className: "t-display", spec: "32/40 -> 48/56, weight 900, -0.02em", note: "Home hero heading only" },
  { className: "t-h1", spec: "28/36 -> 32/40, weight 700", note: "Page titles" },
  { className: "t-h2", spec: "22/28 -> 24/32, weight 700", note: "Section titles" },
  { className: "t-h3", spec: "18/24, weight 700", note: "Card and panel titles" },
  { className: "t-body-lg", spec: "16/24, weight 400", note: "Lead paragraphs" },
  { className: "t-body", spec: "14/20, weight 400", note: "Default body copy" },
  { className: "t-body-strong", spec: "14/20, weight 500", note: "Emphasised body copy" },
  { className: "t-label", spec: "12/16, weight 500", note: "Field labels — sentence case" },
  { className: "t-caption", spec: "12/16, weight 400", note: "Meta, hints, badges" },
  { className: "t-button", spec: "14/20, weight 700", note: "16/24 on lg buttons" },
];

// R8 — button variants. Names match the buttonVariants rebuild in Part 2; until
// then the shared component falls back to its default variant for the new names.
const BUTTON_VARIANTS = ["primary", "secondary", "tertiary", "destructive", "link"];
const BUTTON_SIZES = ["sm", "md", "lg", "icon"];

// R8 — status badges always carry an icon plus a word.
const STATUS_BADGES = [
  { label: "Pending", Icon: Clock, className: "bg-raised text-ink" },
  { label: "Approved", Icon: Check, className: "bg-ok-bg text-ok" },
  { label: "Rejected", Icon: X, className: "bg-danger-bg text-danger" },
];

const isoDateInDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

// Mock event for the sample card. Dates are relative so the registration
// status never decays. image_url is empty on purpose: the card must go through
// the untouched image-fallback authority exactly as production does.
const MOCK_EVENT = {
  event_id: "ds-sample-event",
  clann_event_id: "CLN-DSGN-SYST",
  title: "Design Systems Workshop: Tokens, Themes and Accessible Components",
  category: "Workshop",
  mode: "Offline",
  city: "Delhi",
  location: "India Habitat Centre, Lodhi Road",
  short_description:
    "A hands-on session on building a flat, token-driven interface with light and dark themes.",
  full_description:
    "Learn how a single set of design tokens drives two themes, why flat surfaces beat glass, and how to keep every contrast ratio above WCAG AA.",
  event_date: isoDateInDays(18),
  start_time: "10:00",
  end_time: "13:00",
  registration_deadline: isoDateInDays(11),
  is_paid: false,
  price: "",
  total_seats: 40,
  seats_left: 12,
  external_link: "https://unstop.com/design-systems-workshop",
  image_url: "",
};

/* -------------------------------------------------------------------------- */
/* Local layout helpers — tokens only                                         */
/* -------------------------------------------------------------------------- */

const Section = ({ title, note, children }) => (
  <section className="mt-12 first:mt-0">
    <h2 className="t-h2 text-ink">{title}</h2>
    {note ? <p className="t-body mt-1 text-ink-2">{note}</p> : null}
    <div className="mt-4">{children}</div>
  </section>
);

const Label = ({ children, className, ...props }) => (
  <span className={cn("t-label text-ink-2", className)} {...props}>
    {children}
  </span>
);

const CodeName = ({ children }) => (
  <code className="t-caption rounded-sm bg-raised px-2 py-1 text-ink-2">{children}</code>
);

const Row = ({ children, className }) => (
  <div className={cn("flex flex-wrap items-center gap-4", className)}>{children}</div>
);

/* -------------------------------------------------------------------------- */
/* Sections                                                                   */
/* -------------------------------------------------------------------------- */

const ColorSwatches = ({ theme }) => (
  <Section
    title="Colour tokens"
    note="Every value below is a --c-* custom property from src/index.css, exposed through tailwind.config.js as rgb(var(--c-*) / <alpha-value>). Components reference the Tailwind name and never a literal colour."
  >
    <p className="t-body-strong mb-4 text-ink">
      {theme === "light" ? "Light theme values" : "Dark theme values"}
    </p>
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {COLOR_TOKENS.map((t) => (
        <div key={t.tailwind} className="rounded-md border border-line bg-surface p-3">
          <div
            className={cn("h-12 w-full rounded-sm border border-line", t.swatch)}
            aria-hidden="true"
          />
          <p className="t-body-strong mt-2 text-ink">{t.tailwind}</p>
          <p className="t-caption text-ink-muted">{t.token}</p>
          <p className="t-caption text-ink-muted">{t.cssVar}</p>
        </div>
      ))}
    </div>
  </Section>
);

const TextTokens = () => (
  <Section
    title="Text tokens on a surface"
    note="Never pale grey on light. Contrast is verified per theme (R2)."
  >
    <div className="rounded-lg border border-line bg-surface p-4">
      {TEXT_TOKENS.map((t) => (
        <div key={t.tailwind} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
          <p className={cn("t-body-lg", t.className)}>{t.tailwind}</p>
          <p className="t-caption text-ink-muted">{t.note}</p>
        </div>
      ))}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="t-button inline-flex h-11 items-center rounded-full bg-cta px-6 text-on-cta">
          text-on-cta on bg-cta
        </span>
        <span className="t-button inline-flex h-9 items-center rounded-full bg-selected px-4 text-on-selected">
          text-on-selected on bg-selected
        </span>
      </div>
      <p className="t-caption mt-3 text-ink-muted">
        White on orange fails at 3.45:1, so labels on orange are always text-on-cta (5.13:1).
      </p>
    </div>
  </Section>
);

const Typography = () => (
  <Section title="Typography" note="Satoshi. Weights 400 / 500 / 700; 900 is reserved for .t-display. Minimum size 12px.">
    <div className="rounded-lg border border-line bg-surface p-4">
      {TYPE_CLASSES.map((t) => (
        <div key={t.className} className="border-b border-line py-3 last:border-b-0">
          <p className={cn(t.className, "text-ink")}>Explore More. Upskill More.</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <CodeName>.{t.className}</CodeName>
            <span className="t-caption text-ink-muted">{t.spec}</span>
            <span className="t-caption text-ink-muted">— {t.note}</span>
          </div>
        </div>
      ))}
    </div>
  </Section>
);

const Buttons = () => (
  <Section
    title="Buttons"
    note="Pill-shaped, bold, .t-button. One primary action per card and per screen. Part 2 rebuilds buttonVariants; the names below are the target API."
  >
    <div className="rounded-lg border border-line bg-surface p-4">
      <Label>Variants</Label>
      <Row className="mt-2">
        {BUTTON_VARIANTS.map((v) => (
          <Button key={v} variant={v}>
            {v}
          </Button>
        ))}
      </Row>

      <Label>Sizes</Label>
      <Row className="mt-2">
        {BUTTON_SIZES.map((s) =>
          s === "icon" ? (
            <Button key={s} size={s} variant="secondary" aria-label="Open settings">
              <Settings2 size={20} strokeWidth={1.75} />
            </Button>
          ) : (
            <Button key={s} size={s} variant="primary">
              {s}
            </Button>
          )
        )}
      </Row>

      <Label>States</Label>
      <Row className="mt-2">
        <Button variant="primary">Default</Button>
        <Button variant="primary" className="bg-cta-hover">
          Hover
        </Button>
        <Button variant="primary" className="scale-[0.98] bg-cta-hover">
          Active
        </Button>
        <Button variant="primary" disabled>
          Disabled
        </Button>
        <Button variant="primary" disabled>
          <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
          Loading
        </Button>
      </Row>
      <p className="t-caption mt-3 text-ink-muted">
        Disabled is bg-raised plus text-ink-disabled and pointer-events-none — never opacity alone.
        Loading swaps in a 16px spinner, keeps the label and holds the width.
      </p>
    </div>
  </Section>
);

const FormFields = () => {
  const describedBy = "ds-field-error";
  return (
    <Section
      title="Form fields"
      note="Label above in .t-label text-ink-2, required fields end with a star. Hint in .t-caption text-ink-muted. Error is a 16px icon plus a sentence, wired with aria-invalid and aria-describedby."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-line bg-surface p-4">
          <Label>Default — interactive, hover and tab into me</Label>
          <Input className="mt-2" placeholder="Event title" aria-label="Default field" />
          <p className="t-caption mt-2 text-ink-muted">This is the hint text.</p>
        </div>

        <div className="rounded-lg border border-line bg-surface p-4">
          <Label>Hover</Label>
          <Input className="mt-2 border-ink-2" placeholder="Event title" readOnly aria-label="Hover state" />
          <p className="t-caption mt-2 text-ink-muted">hover:border-ink-2</p>
        </div>

        <div className="rounded-lg border border-line bg-surface p-4">
          <Label>Focus</Label>
          <Input
            className="mt-2 border-ink ring-2 ring-focus ring-offset-2 ring-offset-surface"
            placeholder="Event title"
            readOnly
            aria-label="Focus state"
          />
          <p className="t-caption mt-2 text-ink-muted">
            focus-visible:border-ink plus the global 2px focus ring at a 2px offset.
          </p>
        </div>

        <div className="rounded-lg border border-line bg-surface p-4">
          <Label id="ds-event-title-label">Event title *</Label>
          <Input
            className="mt-2 border-danger"
            placeholder="Event title"
            readOnly
            aria-invalid="true"
            aria-label="Error state"
            aria-describedby={describedBy}
          />
          <p id={describedBy} className="t-caption mt-2 inline-flex items-start gap-2 text-danger">
            <AlertCircle size={16} strokeWidth={1.75} className="mt-0 shrink-0" />
            Enter an event title so reviewers can identify it.
          </p>
        </div>

        <div className="rounded-lg border border-line bg-surface p-4">
          <Label>Disabled</Label>
          <Input className="mt-2" placeholder="Event title" disabled aria-label="Disabled state" />
          <p className="t-caption mt-2 text-ink-muted">disabled:bg-raised disabled:text-ink-disabled</p>
        </div>

        <div className="rounded-lg border border-line bg-surface p-4">
          <Label>Textarea — min-h-24, px-4 py-3</Label>
          <Textarea className="mt-2" placeholder="Describe the event" aria-label="Textarea example" />
        </div>
      </div>
    </Section>
  );
};

const ChipsAndBadges = ({ theme }) => (
  <Section
    title="Chips, badges and tabs"
    note="Selected is bg-selected text-on-selected — never orange. Category chips are bg-chip; in the dark theme their label steps down to text-ink-2."
  >
    <div className="rounded-lg border border-line bg-surface p-4">
      <Label>Category chips — h-9, px-4, rounded-full</Label>
      <Row className="mt-2">
        {["Workshops", "Meetups", "Hackathons", "Conferences"].map((c, i) => (
          <button
            key={c}
            type="button"
            className={cn(
              "t-button inline-flex h-9 items-center rounded-full px-4 transition-colors duration-fast ease-standard",
              i === 1
                ? "bg-selected text-on-selected"
                : cn("bg-chip hover:bg-raised", theme === "light" ? "text-ink" : "text-ink-2")
            )}
          >
            {c}
          </button>
        ))}
      </Row>
      <p className="t-caption mt-2 text-ink-muted">Second chip is the selected state.</p>

      <Label className="mt-6 block">Tab list — bg-raised rounded-full p-1</Label>
      <div className="mt-2 inline-flex h-auto items-center rounded-full bg-raised p-1">
        {["Upcoming", "Saved", "Past"].map((t, i) => (
          <span
            key={t}
            className={cn(
              "t-button inline-flex min-h-9 items-center rounded-full px-4",
              i === 0 ? "bg-selected text-on-selected" : "text-ink-2"
            )}
          >
            {t}
          </span>
        ))}
      </div>

      <Label className="mt-6 block">Neutral badges — h-6, px-2, .t-caption weight 500</Label>
      <Row className="mt-2">
        <span className="t-caption inline-flex h-6 items-center rounded-full bg-chip px-2 font-medium text-ink">
          Workshop
        </span>
        <span className="t-caption inline-flex h-6 items-center rounded-full bg-chip px-2 font-medium text-ink">
          Offline
        </span>
        <span className="t-caption inline-flex h-6 items-center rounded-full bg-chip px-2 font-medium text-ink">
          Free
        </span>
        <span className="t-caption inline-flex h-6 items-center rounded-full bg-cta px-2 font-medium text-on-cta">
          Closing soon
        </span>
      </Row>
      <p className="t-caption mt-2 text-ink-muted">
        The orange badge is the urgent one: at most one per card, reserved for closing soon.
      </p>

      <Label className="mt-6 block">Status badges — icon plus word, colour never alone</Label>
      <Row className="mt-2">
        {STATUS_BADGES.map(({ label, Icon, className }) => (
          <span
            key={label}
            className={cn(
              "t-caption inline-flex h-6 items-center gap-1 rounded-full px-2 font-medium",
              className
            )}
          >
            <Icon size={16} strokeWidth={1.75} />
            {label}
          </span>
        ))}
      </Row>
      <p className="t-caption mt-2 text-ink-muted">
        There is no warning colour. Amber pending becomes neutral bg-raised with a clock icon.
      </p>
    </div>
  </Section>
);

const SampleEventCard = ({ index, usedImages, imageSrc }) => (
  <Section
    title="Event card"
    note="The real EventCard component with a mock event, so the image path goes through the untouched image-fallback authority."
  >
    <div className="max-w-sm">
      <EventCard
        event={MOCK_EVENT}
        index={index}
        usedImages={usedImages}
        imageSrc={imageSrc}
      />
    </div>
    <p className="t-caption mt-3 text-ink-muted">
      Until Part 2 migrates it, the card still carries its legacy hardcoded dark colours and will
      look the same in both panels. Its tokens, radius and spacing are converted in Part 2.
    </p>
  </Section>
);

const FeedbackStates = () => (
  <Section title="Empty, loading and error states" note="No spinners for lists. Colour never carries meaning alone.">
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-lg border border-line bg-surface p-4">
        <Label>Empty</Label>
        <div className="mt-3 flex flex-col items-center py-8 text-center">
          <Search size={32} strokeWidth={1.75} className="text-ink-2" aria-hidden="true" />
          <h3 className="t-h3 mt-4 text-ink">No events match that search</h3>
          <p className="t-body mt-2 text-ink-2">Try a different keyword or browse all events.</p>
          <Button variant="secondary" className="mt-4">
            Browse all events
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-surface p-4">
        <Label>Loading — skeleton matching the final layout</Label>
        <div className="mt-3 space-y-3">
          <Skeleton className="aspect-video w-full bg-raised" />
          <Skeleton className="h-4 w-full bg-raised" />
          <Skeleton className="h-4 w-8/12 bg-raised" />
          <Skeleton className="h-11 w-full rounded-full bg-raised" />
        </div>
      </div>

      <div className="rounded-lg border border-line bg-surface p-4">
        <Label>Inline error</Label>
        <div className="mt-3 rounded-md border border-danger bg-danger-bg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} strokeWidth={1.75} className="mt-0 shrink-0 text-danger" />
            <p className="t-body text-danger">We could not load the events. Please try again.</p>
          </div>
          <Button variant="secondary" className="mt-3">
            Retry
          </Button>
        </div>
      </div>
    </div>
  </Section>
);

const ShapeAndElevation = () => (
  <Section
    title="Radius and elevation"
    note="rounded-sm 8px, rounded-md 12px, rounded-lg 16px, rounded-full. Cards, inputs and buttons carry no shadow; elevation is reserved for floating layers and resolves to none in the dark theme."
  >
    <div className="rounded-lg border border-line bg-surface p-4">
      <Row>
        {[
          { name: "rounded-sm", className: "rounded-sm" },
          { name: "rounded-md", className: "rounded-md" },
          { name: "rounded-lg", className: "rounded-lg" },
          { name: "rounded-full", className: "rounded-full" },
        ].map((r) => (
          <div key={r.name} className="text-center">
            <div className={cn("h-16 w-16 border border-line bg-raised", r.className)} aria-hidden="true" />
            <p className="t-caption mt-2 text-ink-muted">{r.name}</p>
          </div>
        ))}
      </Row>

      <Row className="mt-6">
        <div className="w-40 rounded-md border border-line bg-raised p-4 shadow-elev-1">
          <p className="t-body-strong text-ink">shadow-elev-1</p>
          <p className="t-caption text-ink-muted">Dropdown, popover, select, menu, hover-card</p>
        </div>
        <div className="w-40 rounded-lg border border-line bg-raised p-4 shadow-elev-2">
          <p className="t-body-strong text-ink">shadow-elev-2</p>
          <p className="t-caption text-ink-muted">Dialog, alert-dialog, sheet</p>
        </div>
      </Row>
      <p className="t-caption mt-3 text-ink-muted">
        In the dark panel both resolve to none, so those surfaces read as bg-raised plus a border.
      </p>
    </div>
  </Section>
);

const LogoAndScrim = () => (
  <Section
    title="Themed logo and scrim"
    note="One wordmark asset, recoloured by mask over rgb(var(--c-ink)). Scrim is always used with an alpha and never with a blur."
  >
    <div className="rounded-lg border border-line bg-surface p-4">
      <Row className="items-end">
        <div>
          <ThemedLogo className="h-12 w-auto shrink-0" />
          <p className="t-caption mt-2 text-ink-muted">ThemedLogo — /brand/clann-logo.png as a mask</p>
        </div>
        <div className="relative h-24 w-40 overflow-hidden rounded-md border border-line bg-raised">
          <div className="absolute inset-0 bg-scrim/60" aria-hidden="true" />
          <p className="t-caption absolute inset-x-0 bottom-2 text-center text-ink">bg-scrim/60</p>
        </div>
      </Row>
    </div>
  </Section>
);

/* -------------------------------------------------------------------------- */
/* Panel + page                                                               */
/* -------------------------------------------------------------------------- */

const ThemePanel = ({ theme, cardIndex, usedImages, imageSrc }) => (
  <div
    className={cn(
      "rounded-lg border border-line p-4 lg:p-6",
      theme === "light" ? "light bg-canvas text-ink" : "dark bg-canvas text-ink"
    )}
  >
    <header className="border-b border-line pb-4">
      <h2 className="t-h1 text-ink">{theme === "light" ? "Light theme" : "Dark theme"}</h2>
      <p className="t-body mt-1 text-ink-2">
        Rendered by wrapping this panel in a <CodeName>{theme}</CodeName> class. The layout is
        identical; only token values change.
      </p>
    </header>

    <ColorSwatches theme={theme} />
    <TextTokens />
    <Typography />
    <Buttons />
    <FormFields />
    <ChipsAndBadges theme={theme} />
    <SampleEventCard index={cardIndex} usedImages={usedImages} imageSrc={imageSrc} />
    <FeedbackStates />
    <ShapeAndElevation />
    <LogoAndScrim />
  </div>
);

const DesignSystem = () => {
  // Same authority every list page uses. Importing it here does not change how
  // the image src is chosen — it keeps the sample card honest.
  const { map, used } = useMemo(() => assignEventImages([MOCK_EVENT]), []);
  const imageSrc = map.get(MOCK_EVENT.event_id);

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <header className="border-b border-line pb-6">
          <p className="t-label text-ink-2">Clann design system</p>
          <h1 className="t-display mt-2 text-ink">Tokens, type and components</h1>
          <p className="t-body-lg mt-4 max-w-3xl text-ink-2">
            This page is the reference implementation of DESIGN_SYSTEM.md. It is not linked from
            anywhere in the product. Both themes are rendered at once so a token change can be
            reviewed without switching the whole document.
          </p>
          <p className="t-caption mt-4 text-ink-muted">
            Flat and minimal: no glass, no gradients, no glows, no decorative shadows. Surfaces are
            separated by 1px borders and 4px-multiple spacing. Orange is reserved for the single
            most important action on a card or screen.
          </p>
        </header>

        <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ThemePanel theme="light" cardIndex={0} usedImages={used} imageSrc={imageSrc} />
          <ThemePanel theme="dark" cardIndex={1} usedImages={used} imageSrc={imageSrc} />
        </div>

        <footer className="mt-12 border-t border-line pt-6">
          <p className="t-caption text-ink-muted">
            Share and save icon buttons on images are solid, never translucent: bg-surface with a
            border-line, hover bg-raised, saved state bg-selected text-on-selected.
          </p>
          <Row className="mt-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink">
              <Share2 size={20} strokeWidth={1.75} />
            </span>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-selected text-on-selected">
              <Check size={20} strokeWidth={1.75} />
            </span>
          </Row>
        </footer>
      </div>
    </div>
  );
};

export default DesignSystem;
