#!/usr/bin/env node
/**
 * Clann design-system guardrail — DESIGN_SYSTEM.md section "Guardrail".
 *
 * Enforces the rollout's R9 banned-pattern list, the R4 hex/brand allowlist and
 * the R6 4px spacing grid across every file in src/, so the design system
 * cannot silently regress after the rollout. Dependency-free on purpose: it
 * runs on plain Node with nothing from node_modules, which means it can run in
 * CI before an install, in a pre-commit hook, or standalone.
 *
 *   npm run lint:design              human-readable report, exit 1 on violations
 *   npm run lint:design -- --json    machine-readable report
 *   npm run lint:design -- --strict  also fail on stale allowlist entries
 *
 * Sanctioned exceptions live in design-system.allowlist.json (machine-readable,
 * each entry carries a written reason). This script fails if a file contains a
 * value that is not listed, and warns if a listed value no longer appears.
 *
 * Exit codes: 0 = clean, 1 = violations, 2 = the guardrail itself could not run.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(PROJECT_ROOT, "src");
const ALLOWLIST_PATH = path.join(PROJECT_ROOT, "design-system.allowlist.json");

/* ---------------------------------------------------------------------------
 * Rule tables. Each rule id maps to a group so the report and the allowlist
 * share one vocabulary.
 * ------------------------------------------------------------------------- */

const GROUPS = [
  "hex",
  "rgb-literal",
  "r9",
  "palette",
  "spacing",
  "grid-step",
  "text-px",
  "panel-alpha",
  "css",
];

/* DESIGN_SYSTEM.md R9, transcribed literally. `cssOnly` rules apply to
 * stylesheets, where the token definitions themselves live. */
const R9_BANS = [
  { id: "backdrop-blur", re: /\bbackdrop-blur\b/g, why: "R1/R9 no glassmorphism" },
  { id: "bg-gradient", re: /\bbg-gradient\b/g, why: "R9 banned" },
  { id: "gradient-stop", re: /\b(?:from|via|to)-\[/g, why: "R9 banned gradient stop" },
  { id: "blur", re: /(?<!backdrop-)\bblur-(?!none\b)/g, why: "R9 banned" },
  { id: "drop-shadow", re: /\bdrop-shadow\b/g, why: "R9 banned" },
  {
    id: "shadow-size",
    re: /\bshadow-(?:sm|md|lg|xl|2xl)\b/g,
    why: "R9: use shadow-elev-1 / shadow-elev-2 / shadow-none",
  },
  { id: "shadow-arbitrary", re: /\bshadow-\[/g, why: "R9 banned" },
  { id: "bg-black", re: /\bbg-black\b/g, why: "R9: use bg-scrim/60 or a token" },
  { id: "text-black", re: /\btext-black\b/g, why: "R9: use text-ink" },
  { id: "bg-white", re: /\bbg-white\b/g, why: "R9: use bg-surface / bg-canvas" },
  { id: "text-white", re: /\btext-white\b/g, why: "R9: use text-ink / text-on-cta" },
  { id: "border-white", re: /\bborder-white\b/g, why: "R9: use border-line" },
  { id: "tracking-widest", re: /\btracking-widest\b/g, why: "R9 banned" },
  {
    id: "font-black",
    re: /\bfont-black\b/g,
    why: "R9: weight 900 belongs to .t-display only (defined in src/index.css)",
  },
  {
    id: "rounded-oversize",
    re: /\brounded(?:-[a-z]{1,2})?-(?:xl|2xl|3xl)\b/g,
    why: "R5/R9: max radius is rounded-lg",
  },
  { id: "rounded-arbitrary", re: /\brounded(?:-[a-z]{1,2})?-\[/g, why: "R9 banned" },
  { id: "transition-all", re: /\btransition-all\b/g, why: "R5: name the properties" },
  { id: "hover-lift", re: /\bhover:(?:-?translate|scale)\b/g, why: "R1/R9: no hover lift" },
  { id: "mix-blend", re: /\bmix-blend\b/g, why: "R9 banned" },
  { id: "grain", re: /\bgrain\b/g, why: "R9 banned texture", cssOnly: true },
];

/* Tailwind's default palette. A palette class always carries a shade number,
 * which keeps this precise: `text-ink-2` and `bg-selected` are tokens, and a
 * palette word in prose has no shade. */
const PALETTE_NAMES = [
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
  "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink",
  "rose", "slate", "gray", "zinc", "neutral", "stone",
];
const PALETTE_PREFIXES = [
  "bg", "text", "border", "ring", "fill", "stroke", "from", "via", "to",
  "divide", "outline", "decoration", "shadow", "accent", "caret", "placeholder",
];
const PALETTE_RE = new RegExp(
  `\\b(?:${PALETTE_PREFIXES.join("|")})-(?:${PALETTE_NAMES.join("|")})-\\d{2,3}(?:\\/\\d{1,3})?\\b`,
  "g",
);

/* R6: allowed spacing utilities are 0 1 2 3 4 6 8 12 16 plus px. */
const ALLOWED_SPACING = new Set(["0", "1", "2", "3", "4", "6", "8", "12", "16", "px"]);
const SPACING_PROPS = "(?:p|m)(?:[xytrblse])?|gap(?:-[xy])?|space-[xy]";
const SPACING_RE = new RegExp(
  `(?:^|[\\s"'\`{:(,])(-?(?:${SPACING_PROPS}))-(\\d+(?:\\.\\d+)?|px)(?![\\w.\\-])`,
  "g",
);

/* Widths/heights: R6 permits any multiple of 4. The .5 steps are the off-grid
 * ones. Arbitrary [Npx] is checked too, but hairlines below 8px are exempt
 * because R8 sanctions a 2px active-tab indicator. */
const SIZE_RE = new RegExp(
  `(?:^|[\\s"'\`{:(,])((?:min-|max-)?(?:h|w|size)-)(\\d+(?:\\.\\d+)?|\\[\\d+(?:\\.\\d+)?px\\])(?![\\w.\\-])`,
  "g",
);
const HAIRLINE_EXEMPT_PX = 8;

const TEXT_PX_RE = /\btext-\[\d+(?:\.\d+)?px\]/g;
const HEX_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
const RGB_LITERAL_RE = /\brgba?\(\s*-?[\d.]/g;

/* Panel-scale surface tokens. R9 bans translucent PANEL backgrounds; tint fills
 * on small elements (bg-cta/15 badges, bg-scrim/60 overlays, shadcn's
 * bg-muted/50 row hover) are sanctioned and are deliberately not panel tokens.
 * See $ruleBoundaries in design-system.allowlist.json. */
const PANEL_TOKENS = ["canvas", "surface", "raised", "brand", "card", "popover", "background"];
const PANEL_ALPHA_RE = new RegExp(
  `\\bbg-(?:${PANEL_TOKENS.join("|")})\\/\\d{1,3}\\b`,
  "g",
);

const CSS_BANS = [
  { id: "tracking-widest", re: /\btracking-widest\b/g, why: "R9 banned" },
  { id: "font-black", re: /\bfont-black\b/g, why: "R9: use font-weight inside .t-display" },
  { id: "backdrop-filter", re: /\bbackdrop-filter\b/g, why: "R1/R9 no glassmorphism" },
  { id: "grain", re: /\.grain\b|\bgrain\b/g, why: "R9 banned texture" },
  { id: "backdrop-blur", re: /\bbackdrop-blur\b/g, why: "R1/R9 no glassmorphism" },
];

/* ---------------------------------------------------------------------------
 * Comment stripping.
 *
 * Documentation is allowed to quote a banned pattern (DESIGN_SYSTEM.md and the
 * allowlist both do), so comments and JSX text are blanked before matching.
 * Line structure is preserved so reported line numbers stay accurate.
 * ------------------------------------------------------------------------- */

/**
 * @param {string} src raw file source
 * @returns {{ code: string, commentChars: number }} comment chars replaced by
 *   spaces; strings, template literals and regex literals are left intact.
 */
function stripComments(src) {
  let out = "";
  let commentChars = 0;
  let state = "code";
  let i = 0;
  let lastSignificant = "";

  const push = (ch) => {
    out += ch;
    if (!/\s/.test(ch)) lastSignificant = ch;
  };

  while (i < src.length) {
    const c = src[i];
    const c2 = src[i + 1];

    if (state === "code") {
      if (c === "/" && c2 === "/") { state = "line-comment"; out += "  "; i += 2; continue; }
      if (c === "/" && c2 === "*") { state = "block-comment"; out += "  "; i += 2; continue; }
      if (c === "'") { state = "single"; push(c); i++; continue; }
      if (c === '"') { state = "double"; push(c); i++; continue; }
      if (c === "`") { state = "template"; push(c); i++; continue; }
      if (c === "/" && /[(,=:[!&|?{};+\-*%^~<>]$|^$/.test(lastSignificant)) {
        state = "regex"; push(c); i++; continue;
      }
      push(c);
      i++;
      continue;
    }

    if (state === "line-comment") {
      if (c === "\n") { state = "code"; out += "\n"; i++; continue; }
      commentChars++; out += " "; i++; continue;
    }

    if (state === "block-comment") {
      if (c === "*" && c2 === "/") { state = "code"; out += "  "; i += 2; continue; }
      commentChars++; out += c === "\n" ? "\n" : " "; i++; continue;
    }

    /* string / template / regex: copy verbatim, honour backslash escapes */
    if (c === "\\") { out += c + (c2 === "\n" ? "\n" : c2 ?? ""); i += 2; continue; }
    const closer =
      state === "single" ? "'" : state === "double" ? '"' : state === "template" ? "`" : "/";
    out += c;
    if (c === closer) state = "code";
    if (c === "\n" && (state === "single" || state === "double" || state === "regex")) {
      state = "code"; /* unterminated — resync rather than swallow the file */
    }
    i++;
  }

  return { code: out, commentChars };
}

/* ---------------------------------------------------------------------------
 * Scanning
 * ------------------------------------------------------------------------- */

function lineOf(code, index) {
  let line = 1;
  let col = 1;
  for (let i = 0; i < index && i < code.length; i++) {
    if (code[i] === "\n") { line++; col = 1; } else col++;
  }
  return { line, col };
}

function collect(re, code, group, relFile, ruleId, why, findings) {
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(code)) !== null) {
    if (m[0] === "") { re.lastIndex++; continue; }
    const { line, col } = lineOf(code, m.index);
    findings.push({
      file: relFile,
      line,
      col,
      group,
      rule: ruleId,
      value: m[0].trim(),
      why: why || "",
      detail: m.slice(1).filter(Boolean).join(" "),
    });
  }
}

/** Scan one already-read source string. Pure, so tests can call it directly. */
function scanSource(relFile, rawSource) {
  const isCss = /\.css$/.test(relFile);
  const findings = [];

  if (isCss) {
    for (const ban of CSS_BANS) collect(ban.re, rawSource, "css", relFile, ban.id, ban.why, findings);
    return findings;
  }

  const { code } = stripComments(rawSource);

  collect(HEX_RE, code, "hex", relFile, "hex-literal", "R4: components never contain hex codes", findings);
  collect(RGB_LITERAL_RE, code, "rgb-literal", relFile, "rgb-literal", "R4: use rgb(var(--c-token))", findings);
  collect(PALETTE_RE, code, "palette", relFile, "palette-class", "R9: use a semantic token", findings);
  collect(TEXT_PX_RE, code, "text-px", relFile, "arbitrary-text-size", "R3/R9: use the .t-* type scale (min 12px)", findings);
  collect(PANEL_ALPHA_RE, code, "panel-alpha", relFile, "translucent-panel", "R9: panels are opaque; overlays use bg-scrim/60", findings);

  for (const ban of R9_BANS) {
    if (ban.cssOnly) continue;
    collect(ban.re, code, "r9", relFile, ban.id, ban.why, findings);
  }

  SPACING_RE.lastIndex = 0;
  let m;
  while ((m = SPACING_RE.exec(code)) !== null) {
    const [, prop, size] = m;
    const bare = prop.replace(/^-/, "");
    /* R6's single documented exception: pb-20 md:pb-0 clearing the tab bar. */
    if (bare === "pb" && size === "20" && /md:pb-0\b/.test(code)) continue;
    if (ALLOWED_SPACING.has(size)) continue;
    const { line, col } = lineOf(code, m.index + m[0].indexOf(prop));
    findings.push({
      file: relFile, line, col, group: "spacing", rule: "off-scale-spacing",
      value: `${prop}-${size}`,
      why: `R6: allowed scale is 0 1 2 3 4 6 8 12 16 px (${size} is off-grid)`,
      detail: "",
    });
  }

  SIZE_RE.lastIndex = 0;
  while ((m = SIZE_RE.exec(code)) !== null) {
    const [, prop, size] = m;
    let px = null;
    if (/^\[/.test(size)) {
      px = parseFloat(size.slice(1, -2));
      if (Number.isNaN(px) || px % 4 === 0 || px < HAIRLINE_EXEMPT_PX) continue;
    } else {
      if (!/\.\d/.test(size)) continue; /* integer steps are Tailwind defaults */
      px = parseFloat(size) * 4;
      if (px % 4 === 0) continue;
    }
    const { line, col } = lineOf(code, m.index + m[0].indexOf(prop));
    findings.push({
      file: relFile, line, col, group: "grid-step", rule: "off-grid-size",
      value: `${prop}${size}`,
      why: `R6: widths and heights must be multiples of 4 (${px}px is not)`,
      detail: "",
    });
  }

  return findings;
}

function walk(dir, base, acc, skipped) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      walk(abs, base, acc, skipped);
    } else if (/\.(js|jsx|css)$/.test(entry.name)) {
      /* A test must be able to quote a banned pattern in order to assert that
       * the guardrail catches it, exactly as a comment may quote one. Test
       * files are never shipped, so excluding them costs nothing. */
      if (/\.(?:test|spec)\.jsx?$/.test(entry.name)) {
        skipped.testFiles++;
        continue;
      }
      acc.push(path.relative(base, abs).split(path.sep).join("/"));
    }
  }
  return acc;
}

/* ---------------------------------------------------------------------------
 * Allowlist
 * ------------------------------------------------------------------------- */

function loadAllowlist(allowlistPath) {
  if (!fs.existsSync(allowlistPath)) return { entries: [], raw: null };
  const raw = JSON.parse(fs.readFileSync(allowlistPath, "utf8"));
  if (!Array.isArray(raw.entries)) {
    throw new Error(`${allowlistPath}: expected an "entries" array`);
  }
  for (const e of raw.entries) {
    if (!e.file || !e.rule || !Array.isArray(e.values) || !e.reason) {
      throw new Error(
        `${allowlistPath}: entry for ${e.file || "<no file>"} needs file, rule, values[] and reason`,
      );
    }
    if (!GROUPS.includes(e.rule)) {
      throw new Error(`${allowlistPath}: unknown rule "${e.rule}" (known: ${GROUPS.join(", ")})`);
    }
  }
  return { entries: raw.entries, raw };
}

const norm = (v) => String(v).toLowerCase();

function isAllowlisted(finding, entries) {
  return entries.some(
    (e) =>
      e.file === finding.file &&
      e.rule === finding.group &&
      e.values.some((v) => norm(v) === norm(finding.value)),
  );
}

/** An allowlist entry that no longer matches anything is dead weight — surface it. */
function findStaleEntries(entries, allFindings) {
  return entries.flatMap((e) =>
    e.values
      .filter((v) =>
        !allFindings.some(
          (f) => f.file === e.file && f.group === e.rule && norm(f.value) === norm(v),
        ),
      )
      .map((v) => ({ file: e.file, rule: e.rule, value: v })),
  );
}

/* ---------------------------------------------------------------------------
 * Driver
 * ------------------------------------------------------------------------- */

function runGuardrail(options = {}) {
  const root = options.root || PROJECT_ROOT;
  const srcDir = options.srcDir || path.join(root, "src");
  const allowlistPath = options.allowlistPath || path.join(root, "design-system.allowlist.json");

  if (!fs.existsSync(srcDir)) {
    throw new Error(`no src/ directory at ${srcDir}`);
  }

  const { entries } = loadAllowlist(allowlistPath);
  const skipped = { testFiles: 0 };
  const files = walk(srcDir, root, [], skipped).sort();

  const findings = [];
  let commentChars = 0;
  for (const rel of files) {
    const raw = fs.readFileSync(path.join(root, rel), "utf8");
    findings.push(...scanSource(rel, raw));
    if (!/\.css$/.test(rel)) commentChars += stripComments(raw).commentChars;
  }

  const allowlisted = findings.filter((f) => isAllowlisted(f, entries));
  const violations = findings.filter((f) => !isAllowlisted(f, entries));
  const stale = findStaleEntries(entries, findings);

  const byGroup = {};
  for (const g of GROUPS) {
    byGroup[g] = {
      matches: findings.filter((f) => f.group === g).length,
      allowlisted: allowlisted.filter((f) => f.group === g).length,
      violations: violations.filter((f) => f.group === g).length,
    };
  }

  return {
    root,
    filesScanned: files.length,
    files: { js: files.filter((f) => /\.jsx?$/.test(f)).length, css: files.filter((f) => /\.css$/.test(f)).length },
    skippedTestFiles: skipped.testFiles,
    commentCharsStripped: commentChars,
    byGroup,
    totals: {
      matches: findings.length,
      allowlisted: allowlisted.length,
      violations: violations.length,
      staleAllowlistEntries: stale.length,
    },
    violations: violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
    allowlisted: allowlisted.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
    stale,
    ok: violations.length === 0,
  };
}

function pad(s, n) {
  return String(s) + " ".repeat(Math.max(0, n - String(s).length));
}

function formatReport(r) {
  const out = [];
  out.push("Clann design-system guardrail  (DESIGN_SYSTEM.md R4/R6/R9)");
  out.push(
    `scanned ${r.filesScanned} files (${r.files.js} js/jsx, ${r.files.css} css) under ${path.relative(r.root, path.join(r.root, "src"))}/` +
      (r.skippedTestFiles ? ` (+${r.skippedTestFiles} test file(s) exempt)` : ""),
  );
  out.push("");
  out.push(`  ${pad("rule group", 14)}${pad("matches", 9)}${pad("allowlisted", 13)}violations`);
  for (const g of GROUPS) {
    const s = r.byGroup[g];
    out.push(`  ${pad(g, 14)}${pad(s.matches, 9)}${pad(s.allowlisted, 13)}${s.violations}`);
  }
  out.push(
    `  ${pad("TOTAL", 14)}${pad(r.totals.matches, 9)}${pad(r.totals.allowlisted, 13)}${r.totals.violations}`,
  );
  out.push("");
  out.push(
    `  (${r.commentCharsStripped} comment characters were blanked before matching, so docs may quote banned patterns)`,
  );

  if (r.violations.length) {
    out.push("");
    out.push(`VIOLATIONS (${r.violations.length}):`);
    for (const v of r.violations) {
      out.push(`  ${v.file}:${v.line}:${v.col}  [${v.group}/${v.rule}]  ${v.value}`);
      if (v.why) out.push(`      ${v.why}`);
    }
  }

  if (r.allowlisted.length) {
    out.push("");
    out.push(`ALLOWLISTED (${r.allowlisted.length}) — sanctioned, see design-system.allowlist.json:`);
    const perFile = {};
    for (const a of r.allowlisted) {
      perFile[a.file] = perFile[a.file] || {};
      perFile[a.file][a.group] = (perFile[a.file][a.group] || 0) + 1;
    }
    for (const f of Object.keys(perFile).sort()) {
      const parts = Object.entries(perFile[f]).map(([g, n]) => `${g} x${n}`);
      out.push(`  ${f}: ${parts.join(", ")}`);
    }
  }

  if (r.stale.length) {
    out.push("");
    out.push(`STALE ALLOWLIST ENTRIES (${r.stale.length}) — listed but no longer present:`);
    for (const s of r.stale) out.push(`  ${s.file}  [${s.rule}]  ${s.value}`);
  }

  out.push("");
  if (r.ok) {
    out.push(`PASS - 0 unallowlisted violations across ${GROUPS.length} rule groups.`);
  } else {
    out.push(
      `FAIL - ${r.totals.violations} violation(s). Fix the code, or add a reasoned entry to design-system.allowlist.json.`,
    );
  }
  return out.join("\n");
}

function main(argv) {
  const asJson = argv.includes("--json");
  const strict = argv.includes("--strict");
  let root = PROJECT_ROOT;
  const rootIdx = argv.indexOf("--root");
  if (rootIdx !== -1 && argv[rootIdx + 1]) root = path.resolve(argv[rootIdx + 1]);

  let result;
  try {
    result = runGuardrail({ root });
  } catch (err) {
    process.stderr.write(`guardrail error: ${err.message}\n`);
    return 2;
  }

  if (asJson) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    process.stdout.write(formatReport(result) + "\n");
  }

  if (!result.ok) return 1;
  if (strict && result.stale.length) return 1;
  return 0;
}

module.exports = {
  ALLOWED_SPACING,
  GROUPS,
  PALETTE_NAMES,
  PANEL_TOKENS,
  formatReport,
  loadAllowlist,
  runGuardrail,
  scanSource,
  stripComments,
};

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
