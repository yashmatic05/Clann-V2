/**
 * Switch tests — DESIGN_SYSTEM.md R8 "Inputs" and R2's 60-30-10 rule.
 *
 * A switch's on-state must be the `selected` token and NEVER orange: orange is
 * reserved for the single primary action, so an orange switch would compete
 * with it. That rule is asserted here for the switch itself and, because R8
 * states it for all three selection controls, for checkbox and radio too.
 *
 * Every source scan in this file goes through the guardrail's comment stripper
 * first. That matters: ui/switch.jsx's own doc comment quotes
 * `data-[state=checked]:bg-cta` while explaining what call sites must NOT do,
 * so a plain grep reports a violation that does not exist in the code.
 */

const fs = require("fs");
const path = require("path");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const { Switch } = require("./switch");
const { scanSource, stripComments } = require("../../../scripts/check-design-system");

/* __dirname is src/components/ui, so two levels up is src/. */
const SRC = path.resolve(__dirname, "..", "..");

/** Every .js/.jsx file under src/, as src-relative posix paths. */
function sourceFiles() {
  const out = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (/\.jsx?$/.test(entry.name)) out.push(abs);
    }
  })(SRC);
  return out.map((p) => ({ abs: p, rel: path.relative(SRC, p).split(path.sep).join("/") }));
}

/** File source with comments removed, so prose cannot look like a violation. */
const codeOf = (abs) => stripComments(fs.readFileSync(abs, "utf8")).code;

describe("Switch — the R8 on-state rule", () => {
  test("the on-state is the selected token, never orange", () => {
    const code = codeOf(path.join(SRC, "components", "ui", "switch.jsx"));
    expect(code).toContain("data-[state=checked]:bg-selected");
    expect(code).not.toMatch(/data-\[state=checked\]:bg-cta\b/);
    expect(code).not.toMatch(/data-\[state=checked\]:bg-brand\b/);
  });

  test("checkbox and radio follow the same rule", () => {
    for (const file of ["components/ui/checkbox.jsx", "components/ui/radio-group.jsx"]) {
      const code = codeOf(path.join(SRC, file));
      expect({ file, selected: code.includes("data-[state=checked]:bg-selected") }).toEqual({
        file,
        selected: true,
      });
      expect(code).not.toMatch(/data-\[state=checked\]:bg-cta\b/);
    }
  });

  test("no call site overrides a selection control's on-state colour", () => {
    // This is the invariant ui/switch.jsx's doc comment asks for; Part 4 removed
    // the four AdminPanel overrides. Asserting it here keeps them removed.
    const offenders = [];
    for (const { abs, rel } of sourceFiles()) {
      if (/\.test\.jsx?$/.test(rel)) continue;
      const code = codeOf(abs);
      const tagRe = /<(Switch|Checkbox|RadioGroup|RadioGroupItem)\b[\s\S]*?\/?>/g;
      let m;
      while ((m = tagRe.exec(code)) !== null) {
        if (/data-\[state=checked\]:bg-(?!selected)/.test(m[0])) offenders.push(`${rel}: ${m[0].slice(0, 80)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("Switch — rendering and the R6 tap target", () => {
  let errorSpy;
  beforeEach(() => {
    // Radix/framer use useLayoutEffect, which React DOM server warns about.
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => errorSpy.mockRestore());

  test("renders a real switch role with an unchecked state by default", () => {
    const html = renderToStaticMarkup(
      React.createElement(Switch, { "data-testid": "sub-whatsapp", id: "wa" }),
    );
    document.body.innerHTML = html;
    const el = document.body.querySelector('[role="switch"]');
    expect(el).not.toBeNull();
    expect(el.getAttribute("data-state")).toBe("unchecked");
    expect(el.getAttribute("data-testid")).toBe("sub-whatsapp");
    expect(el.getAttribute("id")).toBe("wa");
  });

  test("a checked switch reports its state for CSS and for tests", () => {
    const html = renderToStaticMarkup(
      React.createElement(Switch, { checked: true, readOnly: true }),
    );
    document.body.innerHTML = html;
    expect(document.body.querySelector('[role="switch"]').getAttribute("data-state")).toBe("checked");
  });

  test("the visible track is 24x44 but the tap target reaches R6's 44px", () => {
    const code = codeOf(path.join(SRC, "components", "ui", "switch.jsx"));
    expect(code).toContain("h-6 w-11");
    // before:-inset-y-3 extends the clickable box 12px above and below.
    expect(code).toContain("before:-inset-y-3");
    const trackHeightPx = 6 * 4; // h-6 = 24px
    const extensionPx = 3 * 4; // -inset-y-3 = 12px each side
    expect(trackHeightPx + extensionPx * 2).toBeGreaterThanOrEqual(44);
    expect(11 * 4).toBeGreaterThanOrEqual(44); // w-11 = 44px
  });

  test("no shadow and no blur on the control (R1/R5)", () => {
    const code = codeOf(path.join(SRC, "components", "ui", "switch.jsx"));
    expect(code).not.toMatch(/\bshadow-(?:sm|md|lg|xl|2xl)\b/);
    expect(code).not.toContain("backdrop-blur");
  });

  test("the rendered markup passes the design-system guardrail", () => {
    const html = renderToStaticMarkup(React.createElement(Switch, null));
    expect(scanSource("src/__probe.jsx", html)).toEqual([]);
  });
});
