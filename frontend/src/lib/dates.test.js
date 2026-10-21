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

describe("todayIST — the India date, never the UTC date", () => {
  const { todayIST } = require("./dates");

  test("is a bare YYYY-MM-DD string", () => {
    expect(todayIST()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("follows Asia/Kolkata, which is UTC+5:30", () => {
    // 2026-10-21 20:00 UTC is already 01:30 IST on 22 October.
    expect(todayIST(new Date("2026-10-21T20:00:00Z"))).toBe("2026-10-22");
    // 2026-10-21 18:29 UTC is 23:59 IST on 21 October.
    expect(todayIST(new Date("2026-10-21T18:29:00Z"))).toBe("2026-10-21");
    // Just after IST midnight: 18:31 UTC is 00:01 IST on 22 October.
    expect(todayIST(new Date("2026-10-21T18:31:00Z"))).toBe("2026-10-22");
  });

  test("rolls the year over correctly", () => {
    expect(todayIST(new Date("2026-12-31T19:00:00Z"))).toBe("2027-01-01");
  });
});

describe("isExpiredEvent — date-only, IST, today is not expired", () => {
  const { isExpiredEvent } = require("./dates");
  const TODAY = "2026-10-21";

  test("an event dated today is NOT expired", () => {
    expect(isExpiredEvent(TODAY, TODAY)).toBe(false);
    expect(isExpiredEvent("2026-10-21T18:00:00", TODAY)).toBe(false);
  });

  test("yesterday is expired, tomorrow is not", () => {
    expect(isExpiredEvent("2026-10-20", TODAY)).toBe(true);
    expect(isExpiredEvent("2026-10-22", TODAY)).toBe(false);
  });

  test("compares date-only strings, not timestamps", () => {
    // Same calendar day, earlier clock time — still not expired.
    expect(isExpiredEvent("2026-10-21T00:01:00", TODAY)).toBe(false);
    // A late time on a past day is still expired.
    expect(isExpiredEvent("2026-10-20T23:59:00", TODAY)).toBe(true);
  });

  test("just after IST midnight, yesterday's event is expired", () => {
    const { todayIST } = require("./dates");
    const justAfterMidnight = new Date("2026-10-21T18:31:00Z"); // 00:01 IST, 22 Oct
    expect(isExpiredEvent("2026-10-21", todayIST(justAfterMidnight))).toBe(true);
    expect(isExpiredEvent("2026-10-22", todayIST(justAfterMidnight))).toBe(false);

    // One minute earlier it is still 21 Oct in India, so 21 Oct is not expired.
    const beforeMidnight = new Date("2026-10-21T18:29:00Z"); // 23:59 IST, 21 Oct
    expect(isExpiredEvent("2026-10-21", todayIST(beforeMidnight))).toBe(false);
  });

  test("an empty or unparseable date is never expired", () => {
    expect(isExpiredEvent("", TODAY)).toBe(false);
    expect(isExpiredEvent("   ", TODAY)).toBe(false);
    expect(isExpiredEvent(null, TODAY)).toBe(false);
    expect(isExpiredEvent(undefined, TODAY)).toBe(false);
    expect(isExpiredEvent("not a date", TODAY)).toBe(false);
    expect(isExpiredEvent("32nd of march", TODAY)).toBe(false);
    expect(isExpiredEvent("TBA", TODAY)).toBe(false);
  });

  test("an impossible calendar date is unparseable, not expired", () => {
    expect(isExpiredEvent("2026-02-31", TODAY)).toBe(false);
  });

  test("defaults to today in IST when no reference date is passed", () => {
    expect(isExpiredEvent("1999-01-01")).toBe(true);
    expect(isExpiredEvent("2999-01-01")).toBe(false);
  });
});
