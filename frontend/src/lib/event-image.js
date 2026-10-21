/**
 * Shared event-poster image rules for the admin Image Finder flow.
 *
 * These constants are deliberately NOT in image-fallback.js (that file is a
 * frozen regression lock for the render-time stock fallback — see
 * image-fallback.test.js). Nothing here ever picks, suggests or substitutes a
 * stock image: MIN_LANDSCAPE_RATIO just says when an image is wide enough to
 * look right on a 16:9 card, and STOCK_IMAGE_HOSTS lets the UI RECOGNISE and
 * flag stock URLs — never generate them.
 *
 * MIN_LANDSCAPE_RATIO mirrors the 1.2 width/height threshold that
 * image-fallback.js uses for display (16:9 ≈ 1.78 and 4:3 ≈ 1.33 posters
 * pass; square and portrait images do not), so admin tooling and the render
 * fallback judge "landscape" the same way.
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
