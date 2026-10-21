const pad2 = (n) => String(n).padStart(2, "0");

/**
 * Today's date in India (Asia/Kolkata) as a bare "YYYY-MM-DD" string.
 *
 * Clann is a Delhi-only product and its `event_date` values are date-only
 * strings, so "is this event still upcoming?" has to be answered in IST — not
 * in UTC (which is 5h30m behind and would expire an event 5h30m too early) and
 * not in whatever timezone the viewer's device happens to be in. Intl carries
 * the timezone rules, so there is no offset arithmetic here.
 */
export const todayIST = (now = new Date()) => {
  const base = now instanceof Date ? now : new Date(now ?? Date.now());
  if (Number.isNaN(base.getTime())) return todayIST();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(base);
  const get = (type) => (parts.find((p) => p.type === type) || {}).value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

/**
 * The date part of an event date as "YYYY-MM-DD", or null when there is
 * nothing usable to parse. Date-only strings (what the database and the bulk
 * importer store) are taken at face value, so no timezone can shift them onto
 * the neighbouring day; anything else goes through parseEventDate.
 */
export const eventDateDay = (value) => {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
  if (iso) {
    const [, year, month, day] = iso;
    // Reject impossible calendar dates ("2026-02-31") instead of letting Date
    // roll them over into March.
    const probe = new Date(`${year}-${month}-${day}T12:00:00`);
    if (Number.isNaN(probe.getTime())) return null;
    if (probe.getFullYear() !== Number(year)) return null;
    if (probe.getMonth() + 1 !== Number(month)) return null;
    if (probe.getDate() !== Number(day)) return null;
    return `${year}-${month}-${day}`;
  }

  const d = parseEventDate(raw);
  if (!d) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/**
 * True when the event's date is strictly before `today` (IST by default).
 *
 * An event happening TODAY is not expired, and an empty or unparseable date is
 * never treated as expired — we do not hide events whose date we cannot read.
 */
export const isExpiredEvent = (eventDate, today = todayIST()) => {
  const day = eventDateDay(eventDate);
  if (!day) return false;
  return day < today;
};

export const parseEventDate = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (/^\d+$/.test(raw)) {
    const serial = Number(raw);
    const ms = Math.round((serial - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatEventDate = (value, options = {}) => {
  const d = parseEventDate(value);
  if (!d) return value || "Date TBA";
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  });
};

export const formatEventDateShort = (value) => {
  const d = parseEventDate(value);
  if (!d) return value || "Date TBA";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).padStart(4, "0");
  return `${day}-${month}-${year}`;
};
