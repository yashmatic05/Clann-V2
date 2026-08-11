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

export const pickEventImage = (event, usedSet) => {
  const usedImages = usedSet instanceof Set ? usedSet : new Set();
  const imageUrl = String(event?.image_url ?? "").trim();

  if (imageUrl && !usedImages.has(imageUrl)) {
    usedImages.add(imageUrl);
    return imageUrl;
  }

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
