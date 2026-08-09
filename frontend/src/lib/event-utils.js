import { parseEventDate } from "./dates";

export const daysBetween = (a, b) => {
  const MS = 24 * 60 * 60 * 1000;
  const aa = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bb = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((aa - bb) / MS);
};

export const formatDeadlineDate = (d) => {
  if (!d) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const parseDate = (s) => {
  if (!s) return null;
  const d = parseEventDate(s);
  return d;
};

export const registrationStatus = (event) => {
  const today = new Date();
  const eventDate = parseDate(event.event_date);
  const deadline = parseDate(event.registration_deadline) || eventDate;
  if (!deadline) return { text: "Date TBA", tone: "muted" };
  const diff = daysBetween(deadline, today);
  if (diff < 0) return { text: "Registration closed", tone: "muted" };
  if (diff === 0) return { text: "Registration closes today", tone: "urgent" };
  if (diff === 1) return { text: "1 Day Left", tone: "urgent" };
  if (diff <= 7) return { text: `${diff} Days Left`, tone: "urgent" };
  return { text: `Register before ${formatDeadlineDate(deadline)}`, tone: "normal" };
};

/**
 * Standardized pricing badge label.
 * Free events → "Free". Paid events → the amount with the ₹ symbol always
 * shown (e.g. "₹999"), normalizing any existing ₹/Rs./INR prefix or "/-" suffix.
 */
export const priceLabel = (event) => {
  if (!event || !event.is_paid) return "Free";
  let raw = String(event.price || "").trim();
  if (!raw) return "Paid";
  raw = raw
    .replace(/^(₹|Rs\.?|INR)\s*/i, "")
    .replace(/\/-\s*$/, "")
    .trim();
  return raw ? `₹${raw}` : "Paid";
};

/**
 * Standardized pricing badge colors.
 * Free → green tag. Paid → orange tag.
 */
export const priceBadgeClass = (event) => {
  return event && event.is_paid
    ? "bg-[#F84E00]/15 text-[#F84E00] border border-[#F84E00]/50"
    : "bg-emerald-500/15 text-emerald-300 border border-emerald-400/40";
};
