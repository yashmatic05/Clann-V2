import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapPin, Calendar, Share2, Bookmark, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { registrationStatus, parseDate, priceLabel, priceBadgeClass } from "@/lib/event-utils";

const categoryColor = (cat) => {
  const c = (cat || "").toLowerCase();
  if (c.includes("workshop")) return "bg-[#46176D]/60 text-[#BF72FF] border-[#BF72FF]/40";
  if (c.includes("hackathon")) return "bg-orange-500/15 text-orange-300 border-orange-400/40";
  if (c.includes("meetup")) return "bg-teal-500/15 text-teal-300 border-teal-400/40";
  if (c.includes("conference")) return "bg-blue-500/15 text-blue-300 border-blue-400/40";
  if (c.includes("walk")) return "bg-emerald-500/15 text-emerald-300 border-emerald-400/40";
  if (c.includes("art")) return "bg-pink-500/15 text-pink-300 border-pink-400/40";
  return "bg-[#46176D]/60 text-[#BF72FF] border-[#BF72FF]/40";
};

const EventCard = ({ event, index = 0, initialSaved = false, onUnsave }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(initialSaved);
  const [removing, setRemoving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => { setSaved(initialSaved); }, [initialSaved]);

  const copyLink = async (e) => {
    e.preventDefault(); e.stopPropagation();
    const url = `${window.location.origin}/event/${event.event_id}`;
    try { await navigator.clipboard.writeText(url); toast.success("Link copied!"); }
    catch { toast.error("Could not copy link"); }
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
  const displayDate = (() => {
    const d = parseDate(event.event_date);
    return d ? d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : event.event_date;
  })();

  return (
    <>
      <Link
        to={`/event/${event.event_id}`}
        data-testid={`event-card-${index}`}
        className={`group bg-[#18002C] rounded-xl overflow-hidden border border-[#46176D]/30 hover:border-[#46176D] hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(70,23,109,0.5)] transition-[transform,border-color,box-shadow,opacity] duration-300 flex flex-col ${removing ? "opacity-0 scale-95" : ""}`}
      >
        {/* Image — clean, only copy/save icons overlaid */}
        <div className="relative aspect-video overflow-hidden bg-[#280049]">
          <img
            src={event.image_url}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute top-3 right-3 flex gap-2">
            <button
              onClick={copyLink}
              data-testid={`share-btn-${index}`}
              aria-label="Copy link"
              title="Copy link"
              className="p-2 rounded-full bg-black/50 backdrop-blur hover:bg-[#F84E00] text-white transition-colors"
            >
              <Share2 size={14} />
            </button>
            <button
              onClick={toggleSave}
              data-testid={`save-btn-${index}`}
              aria-label={saved ? "Remove from saved" : "Save event"}
              className={`p-2 rounded-full backdrop-blur transition-colors ${saved ? "bg-[#F84E00] text-white" : "bg-black/50 hover:bg-[#46176D] text-white"}`}
            >
              <Bookmark size={14} fill={saved ? "currentColor" : "none"} />
            </button>
          </div>
        </div>

        <div className="p-4 md:p-5 flex-1 flex flex-col gap-2">
          {/* 1. Tags row */}
          <div className="flex items-center justify-between gap-1.5" data-testid={`card-tags-${index}`}>
            <div className="flex items-center gap-1.5">
              <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase whitespace-nowrap ${categoryColor(event.category)}`}>
                {event.category}
              </span>
              <span className="rounded-md bg-[#280049] text-[#BF72FF] border border-[#46176D]/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                {event.mode}
              </span>
            </div>
            <span data-testid={`card-price-${index}`} className={`rounded-md px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${priceBadgeClass(event)}`}>
              {priceLabel(event)}
            </span>
          </div>

          {/* 2. Title */}
          <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug line-clamp-2">
            {event.title}
          </h3>

          {/* 3. Short description */}
          <p className="text-xs text-[#727272] line-clamp-2">
            {event.short_description}
          </p>

          {/* 4. Location */}
          <div className="flex items-center gap-1.5 text-xs text-white/80">
            <MapPin size={12} className="text-[#BF72FF]"/>
            <span>{event.city}{event.location ? ` | ${event.location.split(",")[0]}` : ""}</span>
          </div>

          {/* 5. Calendar date */}
          <div className="flex items-center gap-1.5 text-xs text-white/80">
            <Calendar size={12} className="text-[#BF72FF]"/>
            <span>{displayDate}</span>
          </div>

          {/* 6. Registration status */}
          <div data-testid={`card-status-${index}`} className={`text-[11px] font-semibold ${
            status.tone === "urgent" ? "text-[#F84E00]" :
            status.tone === "muted" ? "text-[#727272]" :
            "text-[#BF72FF]"
          }`}>
            {status.tone === "urgent" ? (
              <>
                <span className="rocket-bounce inline-flex items-center gap-1">🚀</span>{" "}{status.text}
              </>
            ) : (
              status.text
            )}
          </div>

          {/* CTAs */}
          <div className="mt-auto pt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleRegister}
              disabled={!hasRegLink}
              title={hasRegLink ? "" : "Registration link coming soon"}
              data-testid={`register-btn-${index}`}
              className="inline-flex items-center justify-center gap-1 bg-[#F84E00] hover:bg-[#D14200] active:bg-[#C63E00] disabled:bg-[#2C2C2C] disabled:text-[#727272] disabled:cursor-not-allowed text-white rounded-full px-3 py-2.5 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap"
            >
              Register <ChevronRight size={12} className="hidden sm:inline"/>
            </button>
            <button
              type="button"
              onClick={knowMore}
              data-testid={`knowmore-btn-${index}`}
              className="inline-flex items-center justify-center gap-1 border border-white/70 text-white hover:bg-white hover:text-[#0D0D0D] rounded-full px-3 py-2.5 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap"
            >
              Know More
            </button>
          </div>
        </div>
      </Link>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" data-testid="unsave-confirm">
          <div className="bg-[#18002C] border border-[#46176D] rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-white">Remove from saved list?</h3>
            <p className="mt-1 text-sm text-[#727272]">You can save this event again later.</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirmOpen(false)} data-testid="unsave-cancel" className="flex-1 bg-[#280049] hover:bg-[#46176D] text-[#BF72FF] rounded-full px-4 py-2.5 text-sm font-bold transition-colors">Cancel</button>
              <button onClick={confirmRemove} data-testid="unsave-confirm-btn" className="flex-1 bg-[#F84E00] hover:bg-[#D14200] text-white rounded-full px-4 py-2.5 text-sm font-bold transition-colors">Yes, Remove</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EventCard;
