/**
 * ImageFinder badge tests — the Landscape / Portrait-or-square verdict.
 *
 * The component is admin tooling; rendering the exported OrientationBadge with
 * react-dom/server is enough to lock its contract (word + icon, never colour
 * alone — DESIGN_SYSTEM.md R2). Orientation itself comes from the browser
 * (naturalWidth/naturalHeight via isLandscape), so it is tested in
 * src/lib/event-image.test.js.
 *
 * The whole file is also fed through the design-system guardrail scanner, so a
 * future edit that adds a hex code or a banned class to this component fails
 * here as well as under `npm run lint:design`.
 */

const fs = require("fs");
const path = require("path");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const { OrientationBadge } = require("./ImageFinder");
const { scanSource } = require("../../../scripts/check-design-system");

describe("OrientationBadge — Image Finder approval aid", () => {
  test("landscape verdict reads 'Landscape' with a Check icon", () => {
    const html = renderToStaticMarkup(React.createElement(OrientationBadge, { landscape: true }));
    expect(html).toContain("Landscape");
    expect(html).not.toContain("Portrait");
    expect(html).toContain("lucide-check");
  });

  test("non-landscape verdict reads 'Portrait or square' with a warning icon", () => {
    const html = renderToStaticMarkup(React.createElement(OrientationBadge, { landscape: false }));
    expect(html).toContain("Portrait or square");
    expect(html).not.toContain(">Landscape<");
    // lucide renamed this icon's class between versions — either spelling is the warning triangle
    expect(html).toMatch(/lucide-(?:alert-triangle|triangle-alert)/);
  });

  test("unknown verdict (null) is treated as non-landscape, never as Landscape", () => {
    const html = renderToStaticMarkup(React.createElement(OrientationBadge, { landscape: null }));
    expect(html).toContain("Portrait or square");
  });

  test("is a neutral chip — no orange, no palette colors, no shadows", () => {
    const html = renderToStaticMarkup(React.createElement(OrientationBadge, { landscape: true }));
    expect(html).toContain("bg-chip");
    expect(html).toContain("rounded-full");
    expect(html).not.toMatch(/bg-cta|shadow-/);
  });
});

describe("ImageFinder source — design-system guardrail (R4/R6/R9)", () => {
  test("the component file produces zero findings (it has no allowlist entry)", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "ImageFinder.jsx"), "utf8");
    // scanSource marks findings allowlisted or not; with no allowlist entry for
    // this file, ANY finding is a violation.
    const findings = scanSource("src/components/admin/ImageFinder.jsx", src);
    expect(findings).toEqual([]);
  });
});
