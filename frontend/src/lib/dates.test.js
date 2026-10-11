/**
 * Date formatting tests — locks the DD-MM-YYYY convention.
 *
 * Ground rule for the whole design-system rollout: "never change the DD-MM-YYYY
 * date format". formatEventDateShort is where that lives, and a silent swap to
 * MM-DD-YYYY would be invisible in a build and in a diff review, so it is
 * asserted here with a date whose day and month differ.
 *
 * All fixtures use local-time ISO strings ("...T12:00:00"), which parse as
 * local time, so these tests give the same answer in any timezone. The Excel
 * serial cases assert against toISOString() because that path is UTC-based by
 * definition.
 */

const { parseEventDate, formatEventDate, formatEventDateShort } = require("./dates");

describe("parseEventDate", () => {
  test("returns null for empty and invalid input", () => {
    expect(parseEventDate(null)).toBeNull();
    expect(parseEventDate(undefined)).toBeNull();
    expect(parseEventDate("")).toBeNull();
    expect(parseEventDate("not a date")).toBeNull();
    expect(parseEventDate("32nd of march")).toBeNull();
  });

  test("reads an Excel serial number (the 1900 date system)", () => {
    // Serial 25569 is the Unix epoch, which pins the offset arithmetic.
    expect(parseEventDate("25569").toISOString()).toBe("1970-01-01T00:00:00.000Z");
    expect(parseEventDate("25570").toISOString()).toBe("1970-01-02T00:00:00.000Z");
    expect(parseEventDate(25569).toISOString()).toBe("1970-01-01T00:00:00.000Z");
  });

  test("trims whitespace around a serial before parsing", () => {
    expect(parseEventDate("  25570  ").toISOString()).toBe("1970-01-02T00:00:00.000Z");
  });

  test("reads an ISO date string", () => {
    const d = parseEventDate("2026-03-10T12:00:00");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(10);
  });
});

describe("formatEventDateShort — DD-MM-YYYY", () => {
  test("puts the DAY first, not the month", () => {
    // 10 March: day and month differ, so this fails if the order is swapped.
    expect(formatEventDateShort("2026-03-10T12:00:00")).toBe("10-03-2026");
  });

  test("zero-pads day and month to two digits and the year to four", () => {
    expect(formatEventDateShort("2026-01-05T12:00:00")).toBe("05-01-2026");
    expect(formatEventDateShort("2026-12-31T12:00:00")).toBe("31-12-2026");
  });

  test("always matches the DD-MM-YYYY shape", () => {
    for (const value of [
      "2026-03-10T12:00:00",
      "2026-01-05T12:00:00",
      "2026-11-09T12:00:00",
    ]) {
      expect(formatEventDateShort(value)).toMatch(/^\d{2}-\d{2}-\d{4}$/);
    }
  });

  test("handles a leap day", () => {
    expect(formatEventDateShort("2028-02-29T12:00:00")).toBe("29-02-2028");
  });

  test("falls back to 'Date TBA' when there is nothing to format", () => {
    expect(formatEventDateShort(null)).toBe("Date TBA");
    expect(formatEventDateShort(undefined)).toBe("Date TBA");
    expect(formatEventDateShort("")).toBe("Date TBA");
  });

  test("passes an unparseable label through instead of inventing a date", () => {
    expect(formatEventDateShort("TBA")).toBe("TBA");
    expect(formatEventDateShort("Next month")).toBe("Next month");
  });
});

describe("formatEventDate — long form", () => {
  test("includes the weekday, day, month and year (en-IN)", () => {
    const out = formatEventDate("2026-03-10T12:00:00");
    expect(out).toContain("Tue");
    expect(out).toContain("10");
    expect(out).toContain("Mar");
    expect(out).toContain("2026");
  });

  test("accepts option overrides", () => {
    const out = formatEventDate("2026-03-10T12:00:00", { weekday: undefined });
    expect(out).not.toContain("Tue");
    expect(out).toContain("2026");
  });

  test("falls back the same way as the short form", () => {
    expect(formatEventDate(null)).toBe("Date TBA");
    expect(formatEventDate("")).toBe("Date TBA");
    expect(formatEventDate("TBA")).toBe("TBA");
  });
});
