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
