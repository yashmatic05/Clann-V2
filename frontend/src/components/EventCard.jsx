import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapPin, Calendar, Share2, Bookmark, ChevronRight, Rocket } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { registrationStatus, priceLabel, priceBadgeClass } from "@/lib/event-utils";
import { formatEventDateShort } from "@/lib/dates";
import { eventImageHandlers } from "@/lib/image-fallback";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Category chips are deliberately uniform (R2).
 *
 * The old implementation returned six different Tailwind palette colors
 * (orange/teal/blue/emerald/pink + two raw hex purples) so categories could be
 * told apart by hue. That breaks R2 twice over — components must never contain
 * hex codes or palette names, and 60-30-10 allows exactly one accent (the cta
 * orange) per card. Category is already spelled out as text inside the chip, so
 * the hue carried no information that the label does not.
 *
 * The function keeps its original signature and call sites; every branch now
 * returns the same token-based chip classes.
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

// Shared chip shape (R8 badges are h-6, on the 4px grid, sentence case per R3).
const chipClass =
  "inline-flex h-6 shrink-0 items-center rounded-md border px-2 t-caption font-semibold whitespace-nowrap";

const EventCard = ({ event, index = 0, initialSaved = false, onUnsave, usedImages, imageSrc }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(initialSaved);
  const [removing, setRemoving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => { setSaved(initialSaved); }, [initialSaved]);

  // Same share behavior as EventDetail: native share sheet (Web Share API)
  // when available, otherwise copy the branded message — not the raw URL —
  // to the clipboard. Button, icon and layout are unchanged.
  const copyLink = async (e) => {
    e.preventDefault(); e.stopPropagation();
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
    } catch { toast.error("Failed to copy"); }
  };

  const performSave = async () => {
    if (!user) { toast.error("Please login to save events"); navigate("/auth"); return; }
    try {
      if (saved) {
        if (onUnsave) { setConfirmOpen(true); return; }
        await api.delete(`/events/${event.event_id}/save`);
        setSaved(false); toast.success("Removed from saved");
      } else {
        await api.post(`/events/${event.event_id}/save`);
        setSaved(true); toast.success("Saved!");
      }
    } catch (err) {
      console.error("[event-card] save toggle failed", err);
      toast.error("Something went wrong");
    }
  };

  const toggleSave = (e) => { e.preventDefault(); e.stopPropagation(); performSave(); };

  const confirmRemove = async () => {
    try {
      await api.delete(`/events/${event.event_id}/save`);
      setRemoving(true);
      toast.success("Event removed from saved list");
      setTimeout(() => { onUnsave?.(event.event_id); }, 320);
    } catch { toast.error("Could not remove"); }
    setConfirmOpen(false);
  };

  const hasRegLink = !!(event.external_link && event.external_link.trim());

  const handleRegister = async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) { toast.error("Sign up to register for events"); navigate("/auth"); return; }
    if (!hasRegLink) return;
    try { await api.post(`/events/${event.event_id}/register`); }
    catch (err) { console.error("[event-card] register track failed", err); }
    window.open(event.external_link, "_blank", "noopener,noreferrer");
  };

  const knowMore = (e) => { e.preventDefault(); e.stopPropagation(); navigate(`/event/${event.event_id}`); };

  const status = registrationStatus(event);
  const displayDate = formatEventDateShort(event.event_date);

  return (
    <>
      {/* R1/R5: a flat card — surface + a 1px line border, rounded-lg, no lift,
          no drop shadow and no image zoom on hover. The only hover cue is the
          border stepping from line to line-input. */}
      <Link
        to={`/event/${event.event_id}`}
        data-testid={`event-card-${index}`}
        className={`group bg-surface rounded-lg overflow-hidden border border-line hover:border-line-input transition-[border-color,transform,opacity] duration-standard ease-standard flex flex-col ${removing ? "opacity-0 scale-95" : ""}`}
      >
        {/* Image — clean, only copy/save icons overlaid */}
        <div className="relative aspect-video overflow-hidden bg-raised">
          <img
            {...eventImageHandlers(event, usedImages, imageSrc)}
            alt={event.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {/* R1: flat, opaque chips — no frosted-glass effect and no translucent
              black scrim. Surface/ink keeps them legible over any photograph in
              both themes. R2: orange is never an icon-button hover. */}
          <div className="absolute top-3 right-3 flex gap-2">
            <button
              onClick={copyLink}
              data-testid={`share-btn-${index}`}
              aria-label="Copy link"
              title="Copy link"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors duration-fast ease-standard hover:bg-raised"
            >
              <Share2 size={16} strokeWidth={1.75} />
            </button>
            <button
              onClick={toggleSave}
              data-testid={`save-btn-${index}`}
              aria-label={saved ? "Remove from saved" : "Save event"}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border transition-colors duration-fast ease-standard",
                saved
                  ? "border-selected bg-selected text-on-selected"
                  : "border-line bg-surface text-ink hover:bg-raised"
              )}
            >
              <Bookmark size={16} strokeWidth={1.75} fill={saved ? "currentColor" : "none"} />
            </button>
          </div>
        </div>

        <div className="p-4 flex-1 flex flex-col gap-2">
          {/* 1. Tags row */}
          <div className="flex items-center justify-between gap-2" data-testid={`card-tags-${index}`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className={`${chipClass} ${categoryColor(event.category)}`}>
                {event.category}
              </span>
              <span className={`${chipClass} bg-raised text-ink-2 border-line`}>
                {event.mode}
              </span>
            </div>
            <span data-testid={`card-price-${index}`} className={`${chipClass} ${priceBadgeClass(event)}`}>
              {priceLabel(event)}
            </span>
          </div>

          {/* 2. Title */}
          <h3 className="t-h3 text-ink line-clamp-2">
            {event.title}
          </h3>

          {/* 3. Short description */}
          <p className="t-caption text-ink-muted line-clamp-2">
            {event.short_description}
          </p>

          {/* 4. Location */}
          <div className="flex items-center gap-2 t-caption text-ink-2">
            <MapPin size={16} strokeWidth={1.75} className="shrink-0 text-ink-muted"/>
            <span>{event.city}{event.location ? ` | ${event.location.split(",")[0]}` : ""}</span>
          </div>

          {/* 5. Calendar date */}
          <div className="flex items-center gap-2 t-caption text-ink-2">
            <Calendar size={16} strokeWidth={1.75} className="shrink-0 text-ink-muted"/>
            <span>{displayDate}</span>
          </div>

          {/* 6. Registration status.
              R2/R4: the card's only orange element is the Register button, so
              urgency is carried by the danger token rather than by a second
              shade of orange. */}
          <div data-testid={`card-status-${index}`} className={cn("t-caption font-semibold",
            status.tone === "urgent" ? "text-danger" :
            status.tone === "muted" ? "text-ink-muted" :
            "text-ink-2"
          )}>
            {status.tone === "urgent" ? (
              <>
                {/* R7: no emoji in chrome — the lucide Rocket replaces the 🚀
                    glyph and keeps the existing rocket-bounce animation class.
                    The emoji inside the share message are message content, not
                    chrome, so they are untouched. */}
                <span className="rocket-bounce inline-flex items-center gap-1"><Rocket size={16} strokeWidth={1.75} /></span>{" "}{status.text}
              </>
            ) : (
              status.text
            )}
          </div>

          {/* CTAs — R4: exactly one primary (orange) action per card. */}
          <div className="mt-auto pt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleRegister}
              disabled={!hasRegLink}
              title={hasRegLink ? "" : "Registration link coming soon"}
              data-testid={`register-btn-${index}`}
              className={cn(
                buttonVariants({ variant: "primary", size: "sm" }),
                // Keep the native title tooltip reachable while disabled, which
                // the shared disabled:pointer-events-none would otherwise block.
                "disabled:pointer-events-auto disabled:cursor-not-allowed"
              )}
            >
              Register <ChevronRight size={16} strokeWidth={1.75} className="hidden sm:inline"/>
            </button>
            {/* R8 copy table: "Know More" -> "View details". The data-testid is
                unchanged so existing tests keep passing. */}
            <button
              type="button"
              onClick={knowMore}
              data-testid={`knowmore-btn-${index}`}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              View details
            </button>
          </div>
        </div>
      </Link>

      {confirmOpen && (
        <div className="fixed inset-0 z-40 bg-scrim/60 flex items-center justify-center p-4" data-testid="unsave-confirm">
          <div className="relative z-50 bg-surface border border-line rounded-lg p-6 max-w-sm w-full shadow-elev-2">
            <h3 className="t-h3 text-ink">Remove from saved list?</h3>
            <p className="mt-1 t-body text-ink-2">You can save this event again later.</p>
            <div className="mt-4 flex gap-3">
              <button onClick={() => setConfirmOpen(false)} data-testid="unsave-cancel" className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "flex-1")}>Cancel</button>
              {/* R8: destructive is a RED outline, never orange. */}
              <button onClick={confirmRemove} data-testid="unsave-confirm-btn" className={cn(buttonVariants({ variant: "destructive", size: "sm" }), "flex-1")}>Yes, Remove</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EventCard;
