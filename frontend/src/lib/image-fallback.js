export const STOCK_IMAGE_POOL = [
  "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1600&h=900&q=80",
  "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&h=900&q=80",
  "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1600&h=900&q=80",
  "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1600&h=900&q=80",
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1600&h=900&q=80",
  "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1600&h=900&q=80",
  "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1600&h=900&q=80",
  "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&h=900&q=80",
];

const hashEventId = (eventId) => {
  const value = String(eventId ?? "");
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

/**
 * Pick an unused stock image for `event` and mark it used.
 *
 * This is a RENDER-TIME / DISPLAY-ONLY helper. It never persists anything:
 * the returned URL is never written back to the event object, the database,
 * an Excel sheet, or an API payload. It is called either from
 * `assignEventImages` (pure list-wide assignment) or from an <img> onError
 * handler (broken real image -> visual stock fallback).
 */
export const pickStockImage = (event, usedSet) => {
  const usedImages = usedSet instanceof Set ? usedSet : new Set();
  const startIndex = hashEventId(event?.event_id) % STOCK_IMAGE_POOL.length;
  for (let offset = 0; offset < STOCK_IMAGE_POOL.length; offset += 1) {
    const candidate = STOCK_IMAGE_POOL[(startIndex + offset) % STOCK_IMAGE_POOL.length];
    if (!usedImages.has(candidate)) {
      usedImages.add(candidate);
      return candidate;
    }
  }
  const fallback = STOCK_IMAGE_POOL[startIndex];
  usedImages.add(fallback);
  return fallback;
};

/**
 * Assign a display image to every event in a list, in order:
 *
 *   Priority 1 — real event image (`event.image_url`) is used for its FIRST
 *                occurrence in the list, preserved exactly as stored.
 *   Priority 2 — later duplicates of the same real URL, and events with an
 *                empty image_url, get a stock fallback chosen at render time.
 *
 * Stock images never repeat within the same list (until the pool is
 * exhausted). This function is PURE — it creates its own used-Set — so it is
 * safe under React StrictMode's dev double-render.
 *
 * Returns `{ map, used }`:
 *   map  = Map<event_id, displaySrc>
 *   used = the shared used-Set (pass to cards so their onError fallback also
 *          avoids repeats)
 */
export const assignEventImages = (events) => {
  const used = new Set();
  const map = new Map();
  for (const ev of events || []) {
    if (!ev || ev.event_id == null) continue;
    const imageUrl = String(ev.image_url ?? "").trim();
    if (imageUrl && !used.has(imageUrl)) {
      used.add(imageUrl);
      map.set(ev.event_id, imageUrl);
    } else {
      map.set(ev.event_id, pickStockImage(ev, used));
    }
  }
  return { map, used };
};

/**
 * Backwards-compatible single-event selection (mutates `usedSet` during
 * render). Page-level lists should prefer `assignEventImages`; this is kept
 * for callers that render a single card outside a shared list.
 */
export const pickEventImage = (event, usedSet) => {
  const usedImages = usedSet instanceof Set ? usedSet : new Set();
  const imageUrl = String(event?.image_url ?? "").trim();
  if (imageUrl && !usedImages.has(imageUrl)) {
    usedImages.add(imageUrl);
    return imageUrl;
  }
  return pickStockImage(event, usedImages);
};

/**
 * `<img>` props for an event image: real image first, stock fallback when the
 * real image is missing AND a visual-only stock fallback when the real image
 * fails to load. `preferredSrc` comes from `assignEventImages` when available.
 *
 * The onError handler swaps ONLY the displayed <img> src — the event's stored
 * `image_url` is never modified.
 */
export const eventImageHandlers = (event, usedSet, preferredSrc) => {
  const src = preferredSrc ?? pickEventImage(event, usedSet);
  return {
    src,
    onError: (e) => {
      const fallback = pickStockImage(event, usedSet);
      if (e && e.currentTarget && e.currentTarget.src !== fallback) {
        e.currentTarget.src = fallback;
      }
    },
  };
};
