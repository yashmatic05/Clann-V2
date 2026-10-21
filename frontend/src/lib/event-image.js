/**
 * Shared event-poster image rules for every surface that displays an event
 * image: <EventImage>, the hero banner and the admin Image Finder.
 *
 * Nothing here ever picks, suggests or substitutes an image. The functions are
 * pure predicates:
 *   - MIN_LANDSCAPE_RATIO / isLandscape decide whether an image fills a 16:9
 *     frame or has to be shown whole (16:9 ≈ 1.78 and 4:3 ≈ 1.33 pass; square
 *     and portrait do not).
 *   - STOCK_IMAGE_HOSTS / isStockImageUrl RECOGNISE stock URLs so they can be
 *     flagged, never generated.
 *   - hasUsableImage says whether a stored image_url may be displayed at all.
 */

export const MIN_LANDSCAPE_RATIO = 1.2;

/**
 * True only when BOTH dimensions are positive numbers and
 * width / height >= MIN_LANDSCAPE_RATIO. Unknown dimensions (0, null, NaN,
 * missing) are never landscape.
 */
export const isLandscape = (width, height) => {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return false;
  if (w <= 0 || h <= 0) return false;
  return w / h >= MIN_LANDSCAPE_RATIO;
};

/**
 * Hosts whose URLs are stock-photo material. Used to FLAG existing stock
 * links for replacement — the Image Finder itself must never return one.
 */
export const STOCK_IMAGE_HOSTS = [
  "unsplash.com",
  "pexels.com",
  "pixabay.com",
  "shutterstock.com",
  "istockphoto.com",
  "gettyimages.com",
  "freepik.com",
  "stock.adobe.com",
  "depositphotos.com",
  "dreamstime.com",
  "123rf.com",
];

/**
 * True when `url`'s hostname IS one of STOCK_IMAGE_HOSTS or a subdomain of
 * one (exact-or-".{host}" suffix — so look-alikes like "notunsplash.com" are
 * false). Malformed or empty input is false.
 */
export const isStockImageUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  let hostname;
  try {
    hostname = new URL(url.trim()).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return false;
  }
  if (!hostname) return false;
  return STOCK_IMAGE_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`)
  );
};

/**
 * True when an event has an image we are allowed to show: a non-empty
 * `image_url` after trimming that is NOT hosted on a stock-photo site.
 *
 * This is the single gate used by <EventImage> (placeholder otherwise) and by
 * the hero banner (candidate selection). It never looks at the network — an
 * image that later fails to load is handled by the caller.
 */
export const hasUsableImage = (event) => {
  const url = String(event?.image_url ?? "").trim();
  if (!url) return false;
  return !isStockImageUrl(url);
};
