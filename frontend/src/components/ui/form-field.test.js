/**
 * FormField tests — DESIGN_SYSTEM.md R8 "Inputs".
 *
 * FormField is the component that let five whole forms (OrganizerSubmit,
 * AdminPanel, CompleteProfile, Auth, AdminLogin) adopt the design system
 * WITHOUT touching their validation logic or a single data-testid. The tests
 * below are therefore mostly about that guarantee: the child is cloned, never
 * re-created, so every prop the caller set survives, and the accessibility
 * wiring (id / aria-invalid / aria-describedby) is added for them.
 *
 * Rendered with react-dom/server and then parsed back with jsdom, because
 * @testing-library/react is deliberately not a dependency of this repo.
 */

const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const { FormField } = require("./form-field");
const { scanSource } = require("../../../scripts/check-design-system");

/** Render, then hand back the parsed DOM for querying. */
function render(element) {
  const html = renderToStaticMarkup(element);
  document.body.innerHTML = html;
  return {
    html,
    label: () => document.body.querySelector("label"),
    input: () => document.body.querySelector("input, textarea, select, button"),
    hint: () => document.body.querySelector("p[id$='-hint']"),
    error: () => document.body.querySelector("p[id$='-error']"),
  };
}

const Input = (props) => React.createElement("input", props);

describe("FormField — label, hint and error presentation", () => {
  test("the label sits above the field in .t-label text-ink-2", () => {
    const r = render(
      React.createElement(FormField, { label: "Email" }, React.createElement(Input, { type: "email" })),
    );
    expect(r.label()).not.toBeNull();
    expect(r.label().className).toContain("t-label");
    expect(r.label().className).toContain("text-ink-2");
    expect(r.label().textContent).toBe("Email");
    // label before control in document order
    expect(r.html.indexOf("<label")).toBeLessThan(r.html.indexOf("<input"));
  });

  test("a required field's label ends with ' *'", () => {
    const r = render(
      React.createElement(
        FormField,
        { label: "Email", required: true },
        React.createElement(Input, { type: "email" }),
      ),
    );
    expect(r.label().textContent).toBe("Email *");
  });

  test("an optional field's label does not", () => {
    const r = render(
      React.createElement(FormField, { label: "Notes" }, React.createElement(Input, null)),
    );
    expect(r.label().textContent).toBe("Notes");
    expect(r.label().textContent).not.toContain("*");
  });

  test("a hint renders in .t-caption text-ink-muted", () => {
    const r = render(
      React.createElement(
        FormField,
        { label: "Email", hint: "We only use this to reply." },
        React.createElement(Input, null),
      ),
    );
    expect(r.hint()).not.toBeNull();
    expect(r.hint().textContent).toBe("We only use this to reply.");
    expect(r.hint().className).toContain("t-caption");
    expect(r.hint().className).toContain("text-ink-muted");
  });

  test("an error renders in .t-caption text-danger with a 16px icon and role=alert", () => {
    const r = render(
      React.createElement(
        FormField,
        { label: "Email", error: "Enter a valid email address." },
        React.createElement(Input, null),
      ),
    );
    expect(r.error()).not.toBeNull();
    expect(r.error().textContent).toContain("Enter a valid email address.");
    expect(r.error().className).toContain("t-caption");
    expect(r.error().className).toContain("text-danger");
    expect(r.error().getAttribute("role")).toBe("alert");

    const svg = r.error().querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("width")).toBe("16");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
  });

  test("an error replaces the hint so the two messages never compete", () => {
    const r = render(
      React.createElement(
        FormField,
        { label: "Email", hint: "We only use this to reply.", error: "Required." },
        React.createElement(Input, null),
      ),
    );
    expect(r.error()).not.toBeNull();
    expect(r.hint()).toBeNull();
    expect(r.html).not.toContain("We only use this to reply.");
  });

  test("a falsy error means no error, and the hint stays", () => {
    for (const error of [undefined, null, ""]) {
      const r = render(
        React.createElement(
          FormField,
          { label: "Email", hint: "Optional.", error },
          React.createElement(Input, null),
        ),
      );
      expect(r.error()).toBeNull();
      expect(r.hint()).not.toBeNull();
    }
  });

  test("no label prop means no <label> element at all", () => {
    const r = render(React.createElement(FormField, null, React.createElement(Input, null)));
    expect(r.label()).toBeNull();
  });

  test("the rendered markup passes the design-system guardrail", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        FormField,
        { label: "Email", required: true, hint: "Hint.", error: "Error." },
        React.createElement(Input, null),
      ),
    );
    expect(scanSource("src/__probe.jsx", html)).toEqual([]);
  });
});

describe("FormField — accessibility wiring", () => {
  test("the label's for matches the control's generated id", () => {
    const r = render(
      React.createElement(FormField, { label: "Email" }, React.createElement(Input, null)),
    );
    const forAttr = r.label().getAttribute("for");
    expect(forAttr).toBeTruthy();
    expect(r.input().getAttribute("id")).toBe(forAttr);
  });

  test("an explicit id is used verbatim for both", () => {
    const r = render(
      React.createElement(
        FormField,
        { label: "Email", id: "sub-email" },
        React.createElement(Input, null),
      ),
    );
    expect(r.label().getAttribute("for")).toBe("sub-email");
    expect(r.input().getAttribute("id")).toBe("sub-email");
  });

  test("htmlFor is accepted as an alias for id", () => {
    const r = render(
      React.createElement(
        FormField,
        { label: "Email", htmlFor: "sub-email" },
        React.createElement(Input, null),
      ),
    );
    expect(r.label().getAttribute("for")).toBe("sub-email");
    expect(r.input().getAttribute("id")).toBe("sub-email");
  });

  test("aria-invalid and aria-describedby point at the error when there is one", () => {
    const r = render(
      React.createElement(
        FormField,
        { label: "Email", id: "sub-email", error: "Required." },
        React.createElement(Input, null),
      ),
    );
    expect(r.input().getAttribute("aria-invalid")).toBe("true");
    expect(r.input().getAttribute("aria-describedby")).toBe("sub-email-error");
    expect(r.error().getAttribute("id")).toBe("sub-email-error");
  });

  test("aria-describedby points at the hint when there is no error", () => {
    const r = render(
      React.createElement(
        FormField,
        { label: "Email", id: "sub-email", hint: "Optional." },
        React.createElement(Input, null),
      ),
    );
    expect(r.input().getAttribute("aria-describedby")).toBe("sub-email-hint");
    expect(r.input().hasAttribute("aria-invalid")).toBe(false);
  });

  test("neither hint nor error leaves aria-describedby off entirely", () => {
    const r = render(
      React.createElement(
        FormField,
        { label: "Email", id: "sub-email" },
        React.createElement(Input, null),
      ),
    );
    expect(r.input().hasAttribute("aria-describedby")).toBe(false);
  });
});

describe("FormField — the child is cloned, never re-created", () => {
  test("caller props survive: data-testid, type, value, placeholder, disabled", () => {
    const r = render(
      React.createElement(
        FormField,
        { label: "Email" },
        React.createElement(Input, {
          "data-testid": "sub-email",
          type: "email",
          value: "a@b.com",
          placeholder: "you@example.com",
          disabled: true,
        }),
      ),
    );
    const input = r.input();
    expect(input.getAttribute("data-testid")).toBe("sub-email");
    expect(input.getAttribute("type")).toBe("email");
    expect(input.getAttribute("value")).toBe("a@b.com");
    expect(input.getAttribute("placeholder")).toBe("you@example.com");
    expect(input.hasAttribute("disabled")).toBe(true);
  });

  test("an id the caller already set wins over the generated one", () => {
    const r = render(
      React.createElement(
        FormField,
        { label: "Email", id: "generated" },
        React.createElement(Input, { id: "caller-wins" }),
      ),
    );
    expect(r.input().getAttribute("id")).toBe("caller-wins");
  });

  test("an aria-describedby the caller already set is not overwritten", () => {
    const r = render(
      React.createElement(
        FormField,
        { label: "Email", id: "sub-email", hint: "Optional." },
        React.createElement(Input, { "aria-describedby": "caller-help" }),
      ),
    );
    expect(r.input().getAttribute("aria-describedby")).toBe("caller-help");
  });

  test("aria-invalid=true from the caller survives even with no error message", () => {
    const r = render(
      React.createElement(
        FormField,
        { label: "Email" },
        React.createElement(Input, { "aria-invalid": true }),
      ),
    );
    expect(r.input().getAttribute("aria-invalid")).toBe("true");
  });

  test("with more than one child nothing is cloned, and all children render", () => {
    const r = render(
      React.createElement(
        FormField,
        { label: "Range" },
        React.createElement(Input, { "data-testid": "min" }),
        React.createElement(Input, { "data-testid": "max" }),
      ),
    );
    expect(r.html).toContain('data-testid="min"');
    expect(r.html).toContain('data-testid="max"');
  });

  test("KNOWN GAP: a Radix Select child cannot receive the id, so htmlFor dangles", () => {
    // Radix Select.Root renders no DOM node of its own, so the cloned id lands
    // nowhere and the <label for> has no target. This is not a regression (the
    // labels it replaced had no for at all) but it is recorded here so the gap
    // is visible rather than rediscovered.
    const FakeRadixSelectRoot = () => null;
    const r = render(
      React.createElement(
        FormField,
        { label: "Category", id: "cat" },
        React.createElement(FakeRadixSelectRoot, null),
      ),
    );
    expect(r.label().getAttribute("for")).toBe("cat");
    expect(r.input()).toBeNull();
  });
});
