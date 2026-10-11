/**
 * Guardrail tests — DESIGN_SYSTEM.md Part 5.
 *
 * Two jobs:
 *   1. Prove scripts/check-design-system.js actually catches what R9/R4/R6 ban
 *      and does not false-positive on the sanctioned treatments. A guardrail
 *      that only ever passes is worthless, so the negative cases matter more
 *      than the positive ones.
 *   2. RUN the guardrail over the real src/ and fail the build if it reports a
 *      violation. This is what makes `npm test` enforce the design system.
 *
 * This file is exempt from the guardrail's own scan (see $ruleBoundaries in
 * design-system.allowlist.json) precisely because it has to quote banned
 * patterns in order to assert they are caught.
 */

const fs = require("fs");
const path = require("path");

const {
  ALLOWED_SPACING,
  GROUPS,
  PANEL_TOKENS,
  loadAllowlist,
  runGuardrail,
  scanSource,
  stripComments,
} = require("../scripts/check-design-system");

const FRONTEND_ROOT = path.resolve(__dirname, "..");
const ALLOWLIST_PATH = path.join(FRONTEND_ROOT, "design-system.allowlist.json");

/** Scan a class string as if it were used on an element. */
const scanClass = (className) =>
  scanSource("src/__probe.jsx", `export const Probe = () => <div className="${className}" />;`);

const groupsFor = (className) => scanClass(className).map((f) => f.group);

/* Every one of these MUST be caught. Second element is the expected group. */
const BANNED = [
  ["backdrop-blur-xl", "r9"],
  ["bg-gradient-to-r", "r9"],
  ["from-[#111111]", "r9"],
  ["via-[#222222]", "r9"],
  ["to-[#333333]", "r9"],
  ["blur-sm", "r9"],
  ["drop-shadow-md", "r9"],
  ["shadow-sm", "r9"],
  ["shadow-md", "r9"],
  ["shadow-lg", "r9"],
  ["shadow-xl", "r9"],
  ["shadow-2xl", "r9"],
  ["shadow-[0_0_10px]", "r9"],
  ["bg-black", "r9"],
  ["text-black", "r9"],
  ["bg-white", "r9"],
  ["text-white", "r9"],
  ["border-white", "r9"],
  ["tracking-widest", "r9"],
  ["font-black", "r9"],
  ["rounded-xl", "r9"],
  ["rounded-2xl", "r9"],
  ["rounded-3xl", "r9"],
  ["rounded-t-xl", "r9"],
  ["rounded-[10px]", "r9"],
  ["transition-all", "r9"],
  ["hover:scale-105", "r9"],
  ["hover:-translate-y-1", "r9"],
  ["mix-blend-multiply", "r9"],
  ["text-red-500", "palette"],
  ["bg-slate-100", "palette"],
  ["border-amber-400", "palette"],
  ["text-emerald-600", "palette"],
  ["ring-blue-500", "palette"],
  ["text-[13px]", "text-px"],
  ["bg-surface/85", "panel-alpha"],
  ["bg-canvas/90", "panel-alpha"],
  ["bg-card/70", "panel-alpha"],
  ["p-5", "spacing"],
  ["mt-2.5", "spacing"],
  ["gap-7", "spacing"],
  ["space-x-11", "spacing"],
  ["pb-24", "spacing"],
  ["h-1.5", "grid-step"],
  ["w-[13px]", "grid-step"],
];

/* None of these may be flagged. Each is sanctioned somewhere in DESIGN_SYSTEM.md
 * or is stock shadcn usage that the config maps to a token. */
const SANCTIONED = [
  // overlays and tints (R5/R8, and $reviewedAndAccepted in the allowlist)
  "bg-scrim/60",
  "bg-cta/15",
  "border-cta/50",
  "bg-muted/50",
  "bg-accent/50",
  "bg-primary/20",
  // R4 explicitly sanctions this press feedback
  "active:scale-[0.98]",
  // elevation tokens, not Tailwind shadow sizes
  "shadow-elev-1",
  "shadow-elev-2",
  "shadow-none",
  // R5 radius ceiling
  "rounded-md",
  "rounded-lg",
  "rounded-full",
  // R5 names the properties it animates
  "transition-colors",
  "transition-[width,background-color]",
  "duration-fast",
  "duration-standard",
  "ease-standard",
  "blur-none",
  // the 23 colour tokens plus the shadcn aliases
  "bg-canvas",
  "bg-surface",
  "bg-raised",
  "bg-brand",
  "bg-chip",
  "bg-selected",
  "text-on-selected",
  "border-line",
  "border-line-input",
  "text-ink",
  "text-ink-2",
  "text-ink-muted",
  "text-ink-disabled",
  "bg-cta",
  "hover:bg-cta-hover",
  "text-on-cta",
  "text-cta-text",
  "ring-focus",
  "text-danger",
  "bg-danger-bg",
  "text-ok",
  "bg-ok-bg",
  // the R3 type scale
  "t-display",
  "t-h1",
  "t-h2",
  "t-h3",
  "t-body-lg",
  "t-body",
  "t-body-strong",
  "t-label",
  "t-caption",
  "t-button",
  // R6 allowed spacing scale
  "p-0",
  "p-1",
  "p-2",
  "p-3",
  "p-4",
  "p-6",
  "p-8",
  "p-12",
  "p-16",
  "px-4",
  "py-3",
  "gap-2",
  "space-x-4",
  "mt-6",
  // R6 sizes: any multiple of 4, plus the R8-sanctioned 2px indicator
  "h-11",
  "w-11",
  "h-6",
  "w-2",
  "min-h-24",
  "h-[52px]",
  "h-[2px]",
  // Tailwind's own text sizes (not arbitrary px)
  "text-xs",
  "text-sm",
  "text-base",
  "text-lg",
];

describe("check-design-system: catches every R9 / R4 / R6 ban", () => {
  test.each(BANNED)("%s is reported as %s", (className, group) => {
    expect(groupsFor(className)).toContain(group);
  });

  test("hex literals are reported", () => {
    const f = scanSource("src/__probe.jsx", 'export const C = "#F84E00";');
    expect(f.map((x) => x.group)).toContain("hex");
    expect(f.find((x) => x.group === "hex").value).toBe("#F84E00");
  });

  test("numeric rgb()/rgba() literals are reported", () => {
    const f = scanSource(
      "src/__probe.jsx",
      'export const S = { color: "rgba(0,0,0,0.5)" };',
    );
    expect(f.map((x) => x.group)).toContain("rgb-literal");
  });

  test("every panel token is covered by the translucent-panel rule", () => {
    for (const token of PANEL_TOKENS) {
      expect(groupsFor(`bg-${token}/80`)).toContain("panel-alpha");
    }
  });

  test("the whole R6 forbidden spacing list is caught", () => {
    const forbidden = ["0.5", "1.5", "2.5", "3.5", "5", "7", "9", "10", "11", "14", "20", "24"];
    for (const size of forbidden) {
      expect(ALLOWED_SPACING.has(size)).toBe(false);
      expect(groupsFor(`p-${size}`)).toContain("spacing");
    }
  });
});

describe("check-design-system: no false positives on sanctioned usage", () => {
  test.each(SANCTIONED)("%s is accepted", (className) => {
    expect(scanClass(className)).toEqual([]);
  });

  test("R6's documented pb-20 md:pb-0 exception is honoured", () => {
    const withException = scanSource(
      "src/__probe.jsx",
      'export const P = () => <main className="pb-20 md:pb-0" />;',
    );
    expect(withException).toEqual([]);

    const without = scanSource("src/__probe.jsx", 'export const P = () => <main className="pb-20" />;');
    expect(without.map((f) => f.group)).toContain("spacing");
  });
});

describe("check-design-system: comment and string handling", () => {
  test("a comment may quote a banned pattern without being flagged", () => {
    const src = [
      "/* Removed: backdrop-blur-xl, bg-white and text-red-500. */",
      "// also bg-gradient-to-r and shadow-lg",
      'export const Ok = () => <div className="bg-surface text-ink" />;',
    ].join("\n");
    expect(scanSource("src/__probe.jsx", src)).toEqual([]);
  });

  test("line numbers stay accurate after comments are blanked", () => {
    const src = [
      "/* a",
      "   multi-line",
      "   comment */",
      'export const Bad = () => <div className="bg-white" />;',
    ].join("\n");
    const found = scanSource("src/__probe.jsx", src);
    expect(found).toHaveLength(1);
    expect(found[0].line).toBe(4);
  });

  test("a regex literal containing a quote does not desync the stripper", () => {
    const src = [
      "export const strip = (s) => s.replace(/^(Rs\\.|INR)['\"]?/i, \"\");",
      'export const Ok = () => <div className="bg-canvas" />;',
    ].join("\n");
    const { code } = stripComments(src);
    expect(code).toContain("bg-canvas");
    expect(scanSource("src/__probe.jsx", src)).toEqual([]);
  });

  test("stripComments counts the comment CONTENT it blanked (not the markers)", () => {
    // "// hi" -> the two slashes open the comment, the three chars after them
    // are the content that gets blanked and counted. Same for "/* ab */",
    // whose content is the four characters between the markers.
    expect(stripComments("// hi\nconst a = 1;").commentChars).toBe(3);
    expect(stripComments("/* ab */").commentChars).toBe(4);
    expect(stripComments("const a = 1;").commentChars).toBe(0);
  });
});

describe("check-design-system: the real src/ tree", () => {
  const result = runGuardrail({ root: FRONTEND_ROOT });

  test("passes with zero unallowlisted violations", () => {
    if (!result.ok) {
      /* Surface the offending lines in the failure message. */
      throw new Error(
        `${result.totals.violations} violation(s):\n` +
          result.violations.map((v) => `  ${v.file}:${v.line} [${v.group}] ${v.value}`).join("\n"),
      );
    }
    expect(result.ok).toBe(true);
    expect(result.totals.violations).toBe(0);
  });

  test("R9 is fully satisfied: no banned pattern survives anywhere in src", () => {
    expect(result.byGroup.r9.matches).toBe(0);
    expect(result.byGroup.palette.matches).toBe(0);
    expect(result.byGroup.spacing.matches).toBe(0);
    expect(result.byGroup["text-px"].matches).toBe(0);
    expect(result.byGroup["grid-step"].matches).toBe(0);
    expect(result.byGroup["rgb-literal"].matches).toBe(0);
    expect(result.byGroup.css.matches).toBe(0);
  });

  test("every hex in src is accounted for by the allowlist", () => {
    expect(result.byGroup.hex.matches).toBe(result.byGroup.hex.allowlisted);
    expect(result.byGroup.hex.violations).toBe(0);
    expect(result.byGroup.hex.matches).toBeGreaterThan(0);

    const hexFiles = [...new Set(result.allowlisted.filter((a) => a.group === "hex").map((a) => a.file))].sort();
    expect(hexFiles).toEqual([
      "src/components/WhatsAppIcon.jsx",
      "src/lib/theme.js",
      "src/pages/Auth.jsx",
    ]);
  });

  test("scans the whole tree, not a sample of it", () => {
    expect(result.filesScanned).toBeGreaterThanOrEqual(80);
    expect(result.files.css).toBeGreaterThan(0);
  });
});

describe("the bundle is not polluted by test fixtures", () => {
  /* This file quotes banned class names so it can prove they are caught.
   * Tailwind's JIT scans content globs for class names, so if test files are in
   * scope it happily emits .bg-white, .rounded-2xl, .tracking-widest and
   * .text-red-500 into the PRODUCTION css bundle — which is exactly what R9
   * forbids shipping. The guardrail exempts test files from linting; Tailwind
   * must exempt them from scanning, and the two have to stay in step. */
  const tailwindConfig = require(path.join(FRONTEND_ROOT, "tailwind.config.js"));
  const content = [].concat(tailwindConfig.content || []);

  test("tailwind's content globs cover src", () => {
    expect(content.some((g) => g.includes("./src/**/*."))).toBe(true);
  });

  test("tailwind's content globs exclude test and spec files", () => {
    expect(content.some((g) => g.startsWith("!") && /\.test\./.test(g))).toBe(true);
    expect(content.some((g) => g.startsWith("!") && /\.spec\./.test(g))).toBe(true);
  });

  test("every exclusion really is a negated glob, not a stray pattern", () => {
    for (const glob of content.filter((g) => g.includes(".test.") || g.includes(".spec."))) {
      expect(glob.startsWith("!")).toBe(true);
    }
  });
});

describe("design-system.allowlist.json hygiene", () => {
  const raw = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, "utf8"));
  const result = runGuardrail({ root: FRONTEND_ROOT });

  test("parses and loads without throwing", () => {
    expect(() => loadAllowlist(ALLOWLIST_PATH)).not.toThrow();
    expect(Array.isArray(raw.entries)).toBe(true);
  });

  test("every entry carries a real reason and a review note", () => {
    for (const e of raw.entries) {
      expect(e.reason.length).toBeGreaterThan(40);
      expect(typeof e.review).toBe("string");
      expect(e.review.length).toBeGreaterThan(0);
      expect(GROUPS).toContain(e.rule);
      expect(fs.existsSync(path.join(FRONTEND_ROOT, e.file))).toBe(true);
    }
  });

  test("no entry is stale (listed but no longer present in the code)", () => {
    expect(result.stale).toEqual([]);
  });

  test("no two entries duplicate the same file/rule/value", () => {
    const seen = new Set();
    for (const e of raw.entries) {
      for (const v of e.values) {
        const key = `${e.file}|${e.rule}|${v.toLowerCase()}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });

  test("every allowlisted match really is covered by an entry", () => {
    expect(result.totals.allowlisted).toBe(result.allowlisted.length);
    expect(result.totals.matches).toBe(result.totals.allowlisted + result.totals.violations);
  });
});
