import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapPin, Calendar, ChevronRight, Copy, Bookmark } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { registrationStatus, parseDate } from "@/lib/event-utils";

// Same per-category chip colors as EventCard (kept local — EventCard must stay untouched)
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

/**
 * Compact fixed-size event card (200 x 280px) for horizontal scroll rows
 * on the mobile homepage feed. Never resizes: image is a fixed 100px,
 * title clamps at 2 lines, everything else truncates to 1 line.
 * Register behavior is identical to EventCard.
 */
const CompactEventCard = ({ event, index = 0, initialSaved = false }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(initialSaved);

  useEffect(() => {
    setSaved(initialSaved);
  }, [initialSaved]);

  const copyLink = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/event/${event.event_id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
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
  const displayDate = (() => {
    const d = parseDate(event.event_date);
    return d
      ? d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
      : event.event_date;
  })();

  return (
    <Link
      to={`/event/${event.event_id}`}
      data-testid={`compact-card-${index}`}
      className="group w-[200px] h-[280px] shrink-0 flex flex-col bg-[#18002C] rounded-xl overflow-hidden border border-[#46176D]/30 hover:border-[#46176D] transition-colors"
    >
      {/* Image — fixed 100px height */}
      <div className="relative h-[100px] shrink-0 overflow-hidden bg-[#280049]">
        <img
          src={event.image_url}
          alt={event.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={copyLink}
            aria-label="Copy link"
            title="Copy link"
            className="p-[6px] rounded-full bg-black/50 text-white transition-colors"
          >
            <Copy size={12} />
          </button>
          <button
            type="button"
            onClick={toggleSave}
            aria-label={saved ? "Remove from saved" : "Save event"}
            title={saved ? "Remove from saved" : "Save event"}
            className={`p-[6px] rounded-full bg-black/50 transition-colors ${saved ? "text-[#F84E00]" : "text-white"}`}
          >
            <Bookmark
              size={12}
              fill={saved ? "currentColor" : "none"}
            />
          </button>
        </div>
      </div>

      {/* Content — all lines clamped/truncated to keep the fixed 280px height */}
      <div className="flex-1 min-h-0 p-3 flex flex-col gap-1">
        {/* LEFT GROUP: Category + Mode | RIGHT GROUP: Free/Paid */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase whitespace-nowrap ${categoryColor(event.category)}`}>
              {event.category}
            </span>
            <span className="rounded-md bg-[#280049] text-[#BF72FF] border border-[#46176D]/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap">
              {event.mode}
            </span>
          </div>
          <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold whitespace-nowrap ${event.is_paid ? "border border-[#F84E00] text-[#F84E00]" : "bg-emerald-500/15 text-emerald-300 border border-emerald-400/40"}`}>
            {event.is_paid ? `Paid ${event.price || ""}`.trim() : "Free"}
          </span>
        </div>

        {/* Title — max 2 lines */}
        <h3 className="text-xs font-bold text-white tracking-tight leading-snug line-clamp-2">
          {event.title}
        </h3>

        {/* Location — 1 line, truncated */}
        <p className="flex items-center gap-1 text-[10px] text-white/80 truncate">
          <MapPin size={10} className="text-[#BF72FF] shrink-0" />
          <span className="truncate">
            {event.city}
            {event.location ? ` | ${event.location.split(",")[0]}` : ""}
          </span>
        </p>

        {/* Date — 1 line, truncated */}
        <p className="flex items-center gap-1 text-[10px] text-white/80 truncate">
          <Calendar size={10} className="text-[#BF72FF] shrink-0" />
          <span className="truncate">{displayDate}</span>
        </p>

        {/* Registration status — 1 line, truncated with rocket animation for urgent */}
        <p className={`text-[10px] font-semibold truncate ${
          status.tone === "urgent" ? "text-[#F84E00]" :
          status.tone === "muted" ? "text-[#727272]" :
          "text-[#BF72FF]"
        }`}>
          {status.tone === "urgent" ? (
            <span className="rocket-bounce inline-flex items-center gap-1">🚀</span>
          ) : null}
          {status.text}
        </p>

        {/* Register button — full width, pinned to bottom */}
        <button
          type="button"
          onClick={handleRegister}
          disabled={!hasRegLink}
          title={hasRegLink ? "" : "Registration link coming soon"}
          className="mt-auto w-full inline-flex items-center justify-center gap-1 bg-[#F84E00] hover:bg-[#D14200] active:bg-[#C63E00] disabled:bg-[#2C2C2C] disabled:text-[#727272] disabled:cursor-not-allowed text-white rounded-full px-3 py-2 text-[11px] font-bold transition-colors whitespace-nowrap"
        >
          Register <ChevronRight size={11} />
        </button>
      </div>
    </Link>
  );
};

export default CompactEventCard;
