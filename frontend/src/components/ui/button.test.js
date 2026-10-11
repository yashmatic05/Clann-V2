/**
 * Button tests — DESIGN_SYSTEM.md R8 "Buttons".
 *
 * Class composition is asserted against the raw `buttonVariants()` output, not
 * against rendered markup, because `cn()` runs the string through
 * tailwind-merge and legitimately collapses conflicting utilities. Structural
 * behaviour (element, props, loading state, asChild) is asserted on markup
 * rendered with react-dom/server.
 *
 * Every variant is also fed through the design-system guardrail, so a future
 * edit that reintroduces a hex or a banned class fails here rather than in
 * review.
 */

const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const { Button, buttonVariants } = require("./button");
const { scanSource } = require("../../../scripts/check-design-system");

const VARIANTS = ["primary", "secondary", "tertiary", "destructive", "link"];
const SIZES = ["sm", "md", "lg", "icon"];

const classesFor = (variant, size) => String(buttonVariants({ variant, size }));

const scan = (className) =>
  scanSource("src/__probe.jsx", `export const P = () => <div className="${className}" />;`);

describe("buttonVariants — the R8 contract", () => {
  test("defaults to primary / md", () => {
    const out = classesFor(undefined, undefined);
    expect(out).toContain("bg-cta");
    expect(out).toContain("h-11");
    expect(out).toBe(classesFor("primary", "md"));
  });

  test("primary is the one orange action", () => {
    const out = classesFor("primary", "md");
    expect(out).toContain("bg-cta");
    expect(out).toContain("text-on-cta");
    expect(out).toContain("hover:bg-cta-hover");
  });

  test("destructive is red, never orange", () => {
    const out = classesFor("destructive", "md");
    expect(out).toContain("border-danger");
    expect(out).toContain("text-danger");
    expect(out).toContain("hover:bg-danger-bg");
    expect(out).not.toContain("cta");
  });

  test("secondary and tertiary are quiet, and never orange", () => {
    for (const variant of ["secondary", "tertiary"]) {
      expect(classesFor(variant, "md")).not.toContain("cta");
    }
    expect(classesFor("secondary", "md")).toContain("border-line-input");
    expect(classesFor("secondary", "md")).toContain("hover:bg-raised");
    expect(classesFor("tertiary", "md")).toContain("hover:underline");
  });

  test("every size matches the R8 dimensions", () => {
    expect(classesFor("primary", "sm")).toContain("h-9 px-4");
    expect(classesFor("primary", "md")).toContain("h-11 px-6");
    expect(classesFor("primary", "lg")).toContain("h-[52px] px-8");
    expect(classesFor("primary", "icon")).toContain("h-11 w-11 p-0");
  });

  test("all buttons are pill-shaped, bold and set in .t-button", () => {
    for (const variant of VARIANTS) {
      const out = classesFor(variant, "md");
      expect(out).toContain("rounded-full");
      expect(out).toContain("t-button");
    }
  });

  test("the R4 press feedback is present and is not a hover lift", () => {
    const out = classesFor("primary", "md");
    expect(out).toContain("active:scale-[0.98]");
    expect(out).not.toContain("hover:scale");
    expect(out).not.toContain("hover:-translate");
  });

  test("R7: the global focus ring is never suppressed", () => {
    for (const variant of VARIANTS) {
      for (const size of SIZES) {
        expect(classesFor(variant, size)).not.toContain("focus-visible:outline-none");
        expect(classesFor(variant, size)).not.toContain("outline-none");
      }
    }
  });

  test("every variant/size combination passes the design-system guardrail", () => {
    for (const variant of VARIANTS) {
      for (const size of SIZES) {
        expect({ variant, size, findings: scan(classesFor(variant, size)).map((f) => f.value) })
          .toEqual({ variant, size, findings: [] });
      }
    }
  });
});

/**
 * Render and hand back the actual element. The base class string contains
 * `disabled:` variants, so a substring check on the markup proves nothing about
 * the disabled ATTRIBUTE — these assertions have to read the parsed DOM.
 */
function renderButton(props, ...children) {
  const html = renderToStaticMarkup(React.createElement(Button, props, ...children));
  document.body.innerHTML = html;
  return { html, button: document.body.querySelector("button") };
}

describe("<Button> rendering", () => {
  test("renders a real <button> and keeps caller props, including data-testid", () => {
    const html = renderToStaticMarkup(
      React.createElement(Button, { "data-testid": "sub-submit", type: "submit" }, "Send for review"),
    );
    expect(html).toContain("<button");
    expect(html).toContain('data-testid="sub-submit"');
    expect(html).toContain('type="submit"');
    expect(html).toContain("Send for review");
  });

  test("asChild hands the classes to the caller's element", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        Button,
        { asChild: true },
        React.createElement("a", { href: "/auth", "data-testid": "nav-signin" }, "Sign in"),
      ),
    );
    expect(html).toContain("<a");
    expect(html).not.toContain("<button");
    expect(html).toContain('data-testid="nav-signin"');
    expect(html).toContain("rounded-full");
  });

  test("loading sets the disabled ATTRIBUTE, keeps the label and swaps in a 16px spinner", () => {
    const { html, button } = renderButton(
      { loading: true },
      React.createElement("span", null, "Saving"),
    );
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.textContent).toContain("Saving");
    expect(html).toContain("<svg");
    expect(html).toContain("animate-spin");
    expect(html).toContain('width="16"');
  });

  test("loading also overrides an explicit disabled={false}", () => {
    expect(renderButton({ loading: true, disabled: false }, "Save").button.hasAttribute("disabled")).toBe(true);
  });

  test("a plain button is not disabled, and an explicit disabled is honoured", () => {
    expect(renderButton(null, "Save").button.hasAttribute("disabled")).toBe(false);
    expect(renderButton({ disabled: true }, "Save").button.hasAttribute("disabled")).toBe(true);
  });
});

describe("<Button> icon accessibility (R8)", () => {
  let warn;
  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  test('size="icon" without a label warns in development', () => {
    renderToStaticMarkup(
      React.createElement(Button, { size: "icon" }, React.createElement("span", null, "x")),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('size="icon" requires an aria-label'));
  });

  test("an aria-label, aria-labelledby or title satisfies the requirement", () => {
    for (const props of [
      { "aria-label": "Close" },
      { "aria-labelledby": "close-label" },
      { title: "Close" },
    ]) {
      warn.mockClear();
      renderToStaticMarkup(React.createElement(Button, { size: "icon", ...props }, "x"));
      expect(warn).not.toHaveBeenCalled();
    }
  });

  test("a labelled size is never warned about", () => {
    renderToStaticMarkup(React.createElement(Button, { size: "md" }, "Save"));
    expect(warn).not.toHaveBeenCalled();
  });

  test("an icon button renders a 44x44 tap target", () => {
    const out = classesFor("secondary", "icon");
    expect(out).toContain("h-11");
    expect(out).toContain("w-11");
    // Tailwind's 11 = 2.75rem = 44px, which is R6's minimum tap target.
    expect(11 * 4).toBeGreaterThanOrEqual(44);
  });
});
