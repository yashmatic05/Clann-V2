import React, { useEffect, useState } from "react";
import { Calendar, Code2, Footprints, Mic, Palette, Users, Wrench } from "lucide-react";
import { hasUsableImage, isLandscape } from "@/lib/event-image";
import { cn } from "@/lib/utils";

/**
 * EventImage — the ONE way an event image is rendered anywhere in the product.
 *
 * The rule (DESIGN_SYSTEM.md, "Event images"):
 *   - a real, non-stock `image_url` is shown, and it is ALWAYS the event's own
 *     URL — this component never picks, rewrites, proxies or substitutes one;
 *   - a landscape image fills the frame (`object-cover`);
 *   - a portrait or square image is shown whole (`object-contain`) rather than
 *     cropped, so a poster's text is never cut off;
 *   - with no usable image, or when the image fails to load, a flat category
 *     placeholder is shown. Never a stock photo, never a different image.
 *
 * The frame element is always rendered, in every state, so the page never
 * shifts between "image" and "no image". The caller supplies the size (or
 * aspect ratio) through `className`, exactly as the old <img> did.
 */

const CATEGORY_ICONS = {
  workshop: Wrench,
  meetup: Users,
  hackathon: Code2,
  conference: Mic,
  walk: Footprints,
  "art & sketch": Palette,
};

const CATEGORY_ALIASES = {
  walks: "walk",
  "art and sketch": "art & sketch",
  artsketch: "art & sketch",
  art: "art & sketch",
  sketch: "art & sketch",
};

const SIZE_TOKENS = {
  sm: { icon: 24, showLabel: false },
  md: { icon: 32, showLabel: true },
  lg: { icon: 48, showLabel: true },
};

const normalizeCategory = (category) => {
  const key = String(category || "").trim().toLowerCase();
  const resolved = CATEGORY_ALIASES[key] || key;
  return { key: resolved, Icon: CATEGORY_ICONS[resolved] || Calendar };
};

const EventImage = ({ event, size = "md", className, alt, priority = false }) => {
  const imageUrl = String(event?.image_url ?? "").trim();
  const usable = hasUsableImage(event);
  const [failed, setFailed] = useState(false);
  const [contain, setContain] = useState(false);

  // A new URL is a new image: start from a clean slate so a previous failure or
  // a previous "contain" verdict cannot leak onto it.
  useEffect(() => {
    setFailed(false);
    setContain(false);
  }, [imageUrl]);

  const { icon: iconSize, showLabel } = SIZE_TOKENS[size] || SIZE_TOKENS.md;
  const { key: categoryKey, Icon } = normalizeCategory(event?.category);
  const categoryLabel = String(event?.category || "").trim() || "Event";
  const showImage = usable && !failed;

  const frameProps = showImage
    ? {}
    : {
        role: "img",
        "aria-label": `${categoryLabel} event, no poster yet`,
      };

  return (
    <div
      className={cn("relative overflow-hidden bg-raised", className)}
      data-testid="event-image"
      {...frameProps}
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt={alt ?? event?.title ?? ""}
          referrerPolicy="no-referrer"
          decoding="async"
          loading={priority ? "eager" : "lazy"}
          data-testid="event-image-img"
          className={cn(
            "absolute inset-0 h-full w-full",
            contain ? "object-contain" : "object-cover"
          )}
          onLoad={(e) => {
            const img = e.currentTarget;
            if (!isLandscape(img.naturalWidth, img.naturalHeight)) setContain(true);
          }}
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-1"
          data-testid="event-image-placeholder"
          data-category={categoryKey}
        >
          <Icon
            size={iconSize}
            strokeWidth={1.75}
            className="text-ink-muted"
            aria-hidden="true"
          />
          {showLabel && <span className="t-caption text-ink-muted">{categoryLabel}</span>}
        </div>
      )}
    </div>
  );
};

export default EventImage;
