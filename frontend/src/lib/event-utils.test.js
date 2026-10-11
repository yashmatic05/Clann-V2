/**
 * Event utility tests — pricing copy, registration urgency, and the design
 * tokens those two return.
 *
 * The clock is pinned so "closes today" and "1 Day Left" are deterministic.
 * Event dates are written as local-time ISO strings, which parse as local time,
 * so the expectations hold in any timezone.
 *
 * priceBadgeClass is also fed through the design-system guardrail: it is one of
 * the few places where a class string is computed at runtime rather than
 * written in JSX, so a static scan of the file would not catch a regression in
 * the value it returns.
 */

const { scanSource } = require("../../scripts/check-design-system");
const {
  daysBetween,
  formatDeadlineDate,
  parseDate,
  priceBadgeClass,
  priceLabel,
  registrationStatus,
} = require("./event-utils");

/** "today" for every test in this file: Tuesday 10 March 2026, 09:00 local. */
const TODAY = new Date(2026, 2, 10, 9, 0, 0);

const at = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T12:00:00`;

beforeAll(() => {
  jest.useFakeTimers().setSystemTime(TODAY);
});

afterAll(() => {
  jest.useRealTimers();
});

describe("daysBetween", () => {
  test("counts whole calendar days, ignoring the time of day", () => {
    expect(daysBetween(new Date(2026, 2, 10, 23, 59), new Date(2026, 2, 8, 0, 1))).toBe(2);
    expect(daysBetween(new Date(2026, 2, 8), new Date(2026, 2, 10))).toBe(-2);
    expect(daysBetween(new Date(2026, 2, 10), new Date(2026, 2, 10))).toBe(0);
  });
});

describe("parseDate / formatDeadlineDate", () => {
  test("parseDate delegates to the shared parser", () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate("2026-03-10T12:00:00").getDate()).toBe(10);
  });

  test("formatDeadlineDate is 'Mon D' in en-US, and null-safe", () => {
    expect(formatDeadlineDate(new Date(2026, 3, 10, 12))).toBe("Apr 10");
    expect(formatDeadlineDate(null)).toBeNull();
  });
});

describe("registrationStatus", () => {
  const statusFor = (deadline, eventDate) =>
    registrationStatus({ registration_deadline: deadline, event_date: eventDate });

  test("closed once the deadline has passed", () => {
    expect(statusFor(at(2026, 3, 5))).toEqual({ text: "Registration closed", tone: "muted" });
  });

  test("urgent on the deadline day itself", () => {
    expect(statusFor(at(2026, 3, 10))).toEqual({
      text: "Registration closes today",
      tone: "urgent",
    });
  });

  test("singular '1 Day Left' for tomorrow", () => {
    expect(statusFor(at(2026, 3, 11))).toEqual({ text: "1 Day Left", tone: "urgent" });
  });

  test("plural up to and including a week", () => {
    expect(statusFor(at(2026, 3, 13))).toEqual({ text: "3 Days Left", tone: "urgent" });
    expect(statusFor(at(2026, 3, 17))).toEqual({ text: "7 Days Left", tone: "urgent" });
  });

  test("beyond a week it names the deadline instead of counting down", () => {
    expect(statusFor(at(2026, 4, 10))).toEqual({
      text: "Register before Apr 10",
      tone: "normal",
    });
  });

  test("falls back to the event date when no deadline was supplied", () => {
    expect(statusFor(null, at(2026, 3, 11))).toEqual({ text: "1 Day Left", tone: "urgent" });
  });

  test("no usable date at all reads 'Date TBA', never an empty badge", () => {
    expect(statusFor(null, null)).toEqual({ text: "Date TBA", tone: "muted" });
    expect(statusFor(undefined, undefined)).toEqual({ text: "Date TBA", tone: "muted" });
  });

  test("tone is always one of the three the UI knows how to render", () => {
    for (const d of [at(2026, 3, 5), at(2026, 3, 10), at(2026, 3, 12), at(2026, 6, 1), null]) {
      expect(["muted", "urgent", "normal"]).toContain(statusFor(d, at(2026, 6, 1)).tone);
    }
  });
});

describe("priceLabel", () => {
  test("free and unknown events both read 'Free'", () => {
    expect(priceLabel(null)).toBe("Free");
    expect(priceLabel({})).toBe("Free");
    expect(priceLabel({ is_paid: false, price: "999" })).toBe("Free");
  });

  test("a paid event with no usable amount reads 'Paid', never '₹'", () => {
    expect(priceLabel({ is_paid: true })).toBe("Paid");
    expect(priceLabel({ is_paid: true, price: "" })).toBe("Paid");
    expect(priceLabel({ is_paid: true, price: "   " })).toBe("Paid");
    expect(priceLabel({ is_paid: true, price: "₹" })).toBe("Paid");
  });

  test("always shows exactly one ₹ symbol", () => {
    expect(priceLabel({ is_paid: true, price: "999" })).toBe("₹999");
    expect(priceLabel({ is_paid: true, price: "₹999" })).toBe("₹999");
    expect(priceLabel({ is_paid: true, price: "₹ 999" })).toBe("₹999");
  });

  test("normalizes the Rs. / INR prefixes organizers actually type", () => {
    expect(priceLabel({ is_paid: true, price: "Rs. 999" })).toBe("₹999");
    expect(priceLabel({ is_paid: true, price: "Rs 999" })).toBe("₹999");
    expect(priceLabel({ is_paid: true, price: "rs.999" })).toBe("₹999");
    expect(priceLabel({ is_paid: true, price: "INR 999" })).toBe("₹999");
    expect(priceLabel({ is_paid: true, price: "inr 1,499" })).toBe("₹1,499");
  });

  test("strips the trailing /- and surrounding whitespace", () => {
    expect(priceLabel({ is_paid: true, price: "999/-" })).toBe("₹999");
    expect(priceLabel({ is_paid: true, price: " ₹ 999/- " })).toBe("₹999");
  });

  test("numeric prices are handled as well as strings", () => {
    expect(priceLabel({ is_paid: true, price: 0 })).toBe("Paid");
    expect(priceLabel({ is_paid: true, price: 999 })).toBe("₹999");
  });
});

describe("priceBadgeClass", () => {
  const free = priceBadgeClass({ is_paid: false });
  const paid = priceBadgeClass({ is_paid: true, price: "999" });

  test("free uses the ok tokens, paid uses the cta tokens", () => {
    expect(free).toBe("bg-ok-bg text-ok border border-ok");
    expect(paid).toBe("bg-cta/15 text-cta-text border border-cta/50");
  });

  test("null-safe", () => {
    expect(priceBadgeClass(null)).toBe(free);
    expect(priceBadgeClass(undefined)).toBe(free);
  });

  test("the returned classes pass the design-system guardrail", () => {
    for (const cls of [free, paid]) {
      const findings = scanSource(
        "src/__probe.jsx",
        `export const Badge = () => <span className="${cls}" />;`,
      );
      expect(findings).toEqual([]);
    }
  });

  test("one layout for both themes: no theme-conditional classes are baked in", () => {
    for (const cls of [free, paid]) {
      expect(cls).not.toContain("dark:");
      expect(cls).not.toContain("light:");
      expect(cls).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }
  });
});
