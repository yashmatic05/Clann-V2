import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapPin, Calendar, ChevronRight, Share2, Bookmark, Rocket } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { registrationStatus, priceLabel, priceBadgeClass } from "@/lib/event-utils";
import { formatEventDateShort } from "@/lib/dates";
import { eventImageHandlers } from "@/lib/image-fallback";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Category chips match EventCard (R2). Both are uniform, token-based chips:
 * the old six-hue palette per category is gone because components may not
 * carry hex codes or palette names, and 60-30-10 permits exactly one accent
 * per card. The category is stated as text inside the chip either way.
 */
const categoryColor = (cat) => {
  const c = (cat || "").toLowerCase();
  if (c.includes("workshop")) return "bg-chip text-ink border-line";
  if (c.includes("hackathon")) return "bg-chip text-ink border-line";
  if (c.includes("meetup")) return "bg-chip text-ink border-line";
  if (c.includes("conference")) return "bg-chip text-ink border-line";
  if (c.includes("walk")) return "bg-chip text-ink border-line";
  if (c.includes("art")) return "bg-chip text-ink border-line";
  return "bg-chip text-ink border-line";
};

// Compact chip: R8 badges are h-6. px-1 (not px-2) is deliberate — three chips
// have to fit inside a 200px card at the 12px caption size, and 4px padding is
// still on the 4px grid.
const chipClass =
  "inline-flex h-6 shrink-0 items-center rounded-md border px-1 t-caption font-semibold whitespace-nowrap";

/**
 * Compact fixed-size event card (200 x 280px) for horizontal scroll rows
 * on the mobile homepage feed. Never resizes: image is a fixed 100px,
 * title clamps at 2 lines, everything else truncates to 1 line.
 * Register behavior is identical to EventCard.
 *
 * Vertical budget at the R3 type scale (content box = 280 - 100 image - 16
 * padding = 164px, minus 5 x 4px gaps = 144px):
 *   chips 24 + title 32 + location 16 + date 16 + status 16 + button 36 = 140px
 * so p-2 (not p-3) is what keeps the fixed height from clipping.
 */
const CompactEventCard = ({ event, index = 0, initialSaved = false, usedImages, imageSrc }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(initialSaved);

  useEffect(() => {
    setSaved(initialSaved);
  }, [initialSaved]);

  // Same share behavior as EventDetail/EventCard: native share sheet
  // (Web Share API) when available, otherwise copy the branded message —
  // not the raw URL — to the clipboard. Button, icon and layout unchanged.
  const copyLink = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/event/${event.event_id}`;
    const shareText = "🎯 Found this event on Clann!\n\nCheck it out 👇";
    if (navigator.share) {
      try {
        await navigator.share({ title: event.title || "Clann event", text: shareText, url });
        return;
      } catch (err) {
        // User dismissed the share sheet — nothing to do.
        if (err && err.name === "AbortError") return;
        // Any other failure — fall back to clipboard below.
      }
    }
    try {
      await navigator.clipboard.writeText(`🎯 Found this event on Clann!\n\n${event.title || ""}\n\nCheck it out 👇\n${url}`);
      toast.success("Share message copied!");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const toggleSave = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error("Please login to save events");
      navigate("/auth");
      return;
    }
    try {
      if (saved) {
        await api.delete(`/events/${event.event_id}/save`);
        setSaved(false);
        toast.success("Removed from saved");
      } else {
        await api.post(`/events/${event.event_id}/save`);
        setSaved(true);
        toast.success("Saved!");
      }
    } catch (err) {
      console.error("[compact-card] save toggle failed", err);
      toast.error("Something went wrong");
    }
  };

  const hasRegLink = !!(event.external_link && event.external_link.trim());

  const handleRegister = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error("Sign up to register for events");
      navigate("/auth");
      return;
    }
    if (!hasRegLink) return;
    try {
      await api.post(`/events/${event.event_id}/register`);
    } catch (err) {
      console.error("[compact-card] register track failed", err);
    }
    window.open(event.external_link, "_blank", "noopener,noreferrer");
  };

  const status = registrationStatus(event);
  const displayDate = formatEventDateShort(event.event_date);

  return (
    <Link
      to={`/event/${event.event_id}`}
      data-testid={`compact-card-${index}`}
      className="group w-[200px] h-[280px] shrink-0 flex flex-col bg-surface rounded-lg overflow-hidden border border-line hover:border-line-input transition-colors duration-fast ease-standard"
    >
      {/* Image — fixed 100px height */}
      <div className="relative h-[100px] shrink-0 overflow-hidden bg-raised">
        <img
          {...eventImageHandlers(event, usedImages, imageSrc)}
          alt={event.title}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        {/* R1: solid surface/ink chips instead of a translucent black overlay, so
            they stay legible over any photograph in both themes. */}
        <div className="absolute top-2 right-2 flex items-center gap-2">
          <button
            type="button"
            onClick={copyLink}
            aria-label="Copy link"
            title="Copy link"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors duration-fast ease-standard hover:bg-raised"
          >
            <Share2 size={16} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={toggleSave}
            aria-label={saved ? "Remove from saved" : "Save event"}
            title={saved ? "Remove from saved" : "Save event"}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border transition-colors duration-fast ease-standard",
              saved
                ? "border-selected bg-selected text-on-selected"
                : "border-line bg-surface text-ink hover:bg-raised"
            )}
          >
            <Bookmark
              size={16}
              strokeWidth={1.75}
              fill={saved ? "currentColor" : "none"}
            />
          </button>
        </div>
      </div>

      {/* Content — all lines clamped/truncated to keep the fixed 280px height */}
      <div className="flex-1 min-h-0 p-2 flex flex-col gap-1">
        {/* LEFT GROUP: Category + Mode | RIGHT GROUP: Free/Paid */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <span className={`${chipClass} ${categoryColor(event.category)}`}>
              {event.category}
            </span>
            <span className={`${chipClass} bg-raised text-ink-2 border-line`}>
              {event.mode}
            </span>
          </div>
          <span className={`${chipClass} ${priceBadgeClass(event)}`}>
            {priceLabel(event)}
          </span>
        </div>

        {/* Title — max 2 lines */}
        <h3 className="t-caption font-bold text-ink line-clamp-2">
          {event.title}
        </h3>

        {/* Location — 1 line, truncated */}
        <p className="flex items-center gap-1 t-caption text-ink-2 truncate">
          <MapPin size={16} strokeWidth={1.75} className="text-ink-muted shrink-0" />
          <span className="truncate">
            {event.city}
            {event.location ? ` | ${event.location.split(",")[0]}` : ""}
          </span>
        </p>

        {/* Date — 1 line, truncated */}
        <p className="flex items-center gap-1 t-caption text-ink-2 truncate">
          <Calendar size={16} strokeWidth={1.75} className="text-ink-muted shrink-0" />
          <span className="truncate">{displayDate}</span>
        </p>

        {/* Registration status — 1 line, truncated with rocket animation for urgent.
            R2/R4: urgency uses the danger token so the Register button stays the
            card's only orange element. R7: lucide Rocket replaces the emoji. */}
        <p className={cn("t-caption font-semibold truncate",
          status.tone === "urgent" ? "text-danger" :
          status.tone === "muted" ? "text-ink-muted" :
          "text-ink-2"
        )}>
          {status.tone === "urgent" ? (
            <span className="rocket-bounce inline-flex items-center gap-1"><Rocket size={16} strokeWidth={1.75} /></span>
          ) : null}
          {status.text}
        </p>

        {/* Register button — full width, pinned to bottom.
            R4: the single primary action on this card. */}
        <button
          type="button"
          onClick={handleRegister}
          disabled={!hasRegLink}
          title={hasRegLink ? "" : "Registration link coming soon"}
          className={cn(
            buttonVariants({ variant: "primary", size: "sm" }),
            "mt-auto w-full",
            // Keep the native title tooltip reachable while disabled, which the
            // shared disabled:pointer-events-none would otherwise block.
            "disabled:pointer-events-auto disabled:cursor-not-allowed"
          )}
        >
          Register <ChevronRight size={16} strokeWidth={1.75} />
        </button>
      </div>
    </Link>
  );
};

export default CompactEventCard;
