/**
 * ThemeToggle tests — the visible surface of the Part 5 flip.
 *
 * While ENABLE_LIGHT_MODE was false (Parts 1-4) this component rendered
 * nothing, so there was nothing to test. From Part 5 it ships to every visitor,
 * which makes two things worth locking down:
 *
 *   1. The icon and its accessible name describe the DESTINATION, not the
 *      current state (R8): in dark mode it shows a Sun and says "Switch to
 *      light mode".
 *   2. The pre-mount render trusts the class the bootstrap script already put
 *      on <html>. Because AnimatePresence has initial={false}, the first icon
 *      paints at full opacity, so guessing "dark" here made every light-theme
 *      visitor watch a Sun crossfade into a Moon on every page load once light
 *      became the default. renderToStaticMarkup never runs effects, so `mounted`
 *      is always false in these tests — exactly the first-paint path.
 *
 * Rendered with react-dom/server: @testing-library/react is deliberately not a
 * dependency of this repo.
 */

const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const { ENABLE_LIGHT_MODE } = require("@/lib/theme");
const { scanSource } = require("../../scripts/check-design-system");

let ThemeToggle;

/** Render the toggle against a document whose <html> carries `themeClass`. */
function render(themeClass) {
  document.documentElement.className = themeClass;
  const html = renderToStaticMarkup(React.createElement(ThemeToggle));
  document.body.innerHTML = html;
  return { html, el: () => document.body.querySelector('[data-testid="theme-toggle"]') };
}

beforeAll(() => {
  ThemeToggle = require("./ThemeToggle").default;
});

let errorSpy;
beforeEach(() => {
  // framer-motion uses useLayoutEffect, which React DOM server warns about.
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  errorSpy.mockRestore();
  document.documentElement.className = "";
});

describe("the Part 5 flip made the switch visible", () => {
  test("ENABLE_LIGHT_MODE is on", () => {
    expect(ENABLE_LIGHT_MODE).toBe(true);
  });

  test("it renders, with the test id the rest of the suite relies on", () => {
    const r = render("dark");
    expect(r.el()).not.toBeNull();
    expect(r.html).toContain("<button");
  });

  test('it is type="button" so it can never submit a form it sits inside', () => {
    expect(render("dark").el().getAttribute("type")).toBe("button");
  });
});

describe("first paint follows the bootstrap, so the icon never crossfades on load", () => {
  test("dark document -> Sun, and the label names light as the destination", () => {
    const el = render("dark").el();
    expect(el.getAttribute("aria-label")).toBe("Switch to light mode");
    expect(el.getAttribute("title")).toBe("Switch to light mode");
    expect(el.innerHTML).toContain("lucide-sun");
    expect(el.innerHTML).not.toContain("lucide-moon");
  });

  test("light document -> Moon, and the label names dark as the destination", () => {
    const el = render("").el();
    expect(el.getAttribute("aria-label")).toBe("Switch to dark mode");
    expect(el.getAttribute("title")).toBe("Switch to dark mode");
    expect(el.innerHTML).toContain("lucide-moon");
    expect(el.innerHTML).not.toContain("lucide-sun");
  });

  test("the class the bootstrap sets is the only thing consulted pre-mount", () => {
    // A stored preference is next-themes' business (it resolves in an effect);
    // before that effect runs, the <html> class is the only truth available.
    expect(render("dark").el().getAttribute("aria-label")).not.toBe(
      render("").el().getAttribute("aria-label"),
    );
  });
});

describe("R6 / R8 / R2 compliance", () => {
  test("44x44 tap target, circular, on surface with a line border", () => {
    const cls = render("dark").el().className;
    expect(cls).toContain("h-11");
    expect(cls).toContain("w-11");
    expect(cls).toContain("rounded-full");
    expect(cls).toContain("bg-surface");
    expect(cls).toContain("border-line");
    expect(11 * 4).toBeGreaterThanOrEqual(44);
  });

  test("never orange: no cta token anywhere on the control (R2 60-30-10)", () => {
    const cls = render("dark").el().className;
    expect(cls).not.toContain("cta");
    expect(cls).not.toContain("brand");
    expect(cls).toContain("hover:bg-raised");
  });

  test("no shadow, no blur, no hover lift (R1/R5/R9)", () => {
    const cls = render("dark").el().className;
    expect(cls).not.toMatch(/shadow-(?:sm|md|lg|xl|2xl)/);
    expect(cls).not.toContain("backdrop-blur");
    expect(cls).not.toContain("hover:scale");
    expect(cls).not.toContain("transition-all");
  });

  test("the icon is 20px at strokeWidth 1.75 (R8 icons)", () => {
    const svg = render("dark").el().querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("width")).toBe("20");
    expect(svg.getAttribute("height")).toBe("20");
    expect(svg.getAttribute("stroke-width")).toBe("1.75");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
  });

  test("the rendered markup passes the design-system guardrail", () => {
    expect(scanSource("src/__probe.jsx", render("dark").html)).toEqual([]);
  });
});

describe("integration with the real next-themes provider", () => {
  test("renders inside ThemeProvider without crashing", () => {
    const { ThemeProvider } = require("next-themes");
    const html = renderToStaticMarkup(
      React.createElement(
        ThemeProvider,
        { attribute: "class", storageKey: "clann-theme", defaultTheme: "system", enableSystem: true },
        React.createElement(ThemeToggle),
      ),
    );
    expect(html).toContain('data-testid="theme-toggle"');
  });
});

describe("ESCAPE HATCH: turning light mode back off hides the switch", () => {
  test("with ENABLE_LIGHT_MODE false the component renders nothing", () => {
    let html = "<not rendered>";
    jest.isolateModules(() => {
      jest.doMock("@/lib/theme", () => ({ ENABLE_LIGHT_MODE: false }));
      // React and react-dom/server must come from the SAME isolated registry as
      // the component, or the two React instances disagree about the dispatcher
      // and every hook call throws.
      const IsolatedReact = require("react");
      const { renderToStaticMarkup: isolatedRender } = require("react-dom/server");
      const Off = require("./ThemeToggle").default;
      document.documentElement.className = "dark";
      html = isolatedRender(IsolatedReact.createElement(Off));
    });
    jest.dontMock("@/lib/theme");

    expect(html).toBe("");
  });
});
