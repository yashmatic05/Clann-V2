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
