import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import BottomTabBar from "@/components/BottomTabBar";
import EventCard from "@/components/EventCard";
import { MapPin, Calendar, Clock, Copy, Share2, Bookmark, ChevronRight, Rocket } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { registrationStatus, priceLabel, priceBadgeClass } from "@/lib/event-utils";
import { formatEventDateShort } from "@/lib/dates";
import EventImage from "@/components/EventImage";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Category chips are uniform (R2) — same decision as EventCard,
 * CompactEventCard and EventsListPage: no hex, no palette names, one accent.
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

const chipClass =
  "inline-flex h-6 shrink-0 items-center rounded-md border px-1 t-caption font-semibold whitespace-nowrap";

const RelatedEventCard = ({ event, savedIds }) => {
  const navigate = useNavigate();
  const status = registrationStatus(event);

  return (
    <div
      onClick={() => navigate(`/event/${event.event_id}`)}
      className="flex-shrink-0 w-[200px] h-[300px] bg-surface border border-line hover:border-line-input rounded-lg overflow-hidden cursor-pointer flex flex-col transition-colors duration-fast ease-standard"
    >
      <EventImage event={event} size="sm" className="w-full h-[100px]" />
      <div className="p-2 flex flex-col gap-1 overflow-hidden flex-1">
        {/* Row 1 */}
        <div className="flex">
          <span className={`${chipClass} ${categoryColor(event.category)}`}>
            {event.category}
          </span>
        </div>

        {/* Row 2 */}
        <h4 className="t-caption font-bold text-ink line-clamp-2">
          {event.title}
        </h4>

        {/* Row 3 */}
        <p className="flex items-center gap-1 t-caption text-ink-2 truncate">
          <MapPin size={16} strokeWidth={1.75} className="shrink-0 text-ink-muted" />
          <span className="truncate">
            {event.city}{event.location ? ` | ${event.location.split(",")[0]}` : ""}
          </span>
        </p>

        {/* Row 4 */}
        <p className="flex items-center gap-1 t-caption text-ink-2 truncate">
          <Calendar size={16} strokeWidth={1.75} className="shrink-0 text-ink-muted" />
          <span>{formatEventDateShort(event.event_date)}</span>
        </p>

        {/* Row 5 */}
        <p className={cn("t-caption font-semibold truncate", status.tone === "urgent" ? "text-danger" : "text-ink-muted")}>
          {status.text}
        </p>

        {/* Row 6 */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (event.external_link) {
              window.open(event.external_link, "_blank", "noopener,noreferrer");
            }
          }}
          className={cn(buttonVariants({ variant: "primary", size: "sm" }), "mt-auto w-full")}
        >
          Register
        </button>
      </div>
    </div>
  );
};

const EventDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [related, setRelated] = useState([]);
  const [saved, setSaved] = useState(false);
  const [remindOn, setRemindOn] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/events/${id}`);
        setEvent(data);
        const { data: all } = await api.get("/events");
        setRelated(all.filter((e) => e.event_id !== id).slice(0, 10));
      } catch (err) {
        console.error("[event-detail] load failed", err);
        toast.error("Event not found");
        navigate("/");
      }
    })();
  }, [id, navigate]);

  // load saved + reminder state
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data: sv } = await api.get("/saved");
        setSaved(sv.some((e) => e.event_id === id));
      } catch (err) {
        console.error("[event-detail] load saved failed", err);
      }
      try {
        const { data: prefs } = await api.get("/reminder-prefs");
        setRemindOn(prefs.includes(id));
      } catch (err) {
        console.error("[event-detail] load reminder prefs failed", err);
      }
    })();
  }, [user, id]);

  const share = async () => {
    const url = window.location.href;
    const shareText = "🎯 Found this event on Clann!\n\nCheck it out 👇";
    // Prefer the native share sheet (WhatsApp, Messages, etc.) when available.
    if (navigator.share) {
      try {
        await navigator.share({
          title: event?.title || "Clann event",
          text: shareText,
          url,
        });
        return;
      } catch (err) {
        // User dismissed the share sheet — not an error worth reporting.
        if (err && err.name === "AbortError") return;
        // Any other failure (e.g. share not permitted) — fall back to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(`🎯 Found this event on Clann!\n\n${event?.title || ""}\n\nCheck it out 👇\n${url}`);
      toast.success("Share message copied!");
    } catch { toast.error("Failed to copy"); }
  };

  const copyEventId = async () => {
    if (!event?.clann_event_id) return;
    try {
      await navigator.clipboard.writeText(event.clann_event_id);
      toast.success("Event ID copied");
    } catch { toast.error("Failed to copy"); }
  };

  const toggleSave = async () => {
    if (!user) { toast.error("Please login to save events"); navigate("/auth"); return; }
    try {
      if (saved) { await api.delete(`/events/${id}/save`); setSaved(false); toast.success("Removed"); }
      else { await api.post(`/events/${id}/save`); setSaved(true); toast.success("Saved!"); }
    } catch { toast.error("Something went wrong"); }
  };

  const toggleReminder = async (v) => {
    if (!user) {
      toast.error("Sign up to enable reminders");
      navigate("/auth");
      return;
    }
    try {
      await api.post(`/events/${id}/reminder-toggle`, { enabled: v });
      setRemindOn(v);
      toast.success(v ? "Reminder set for this event" : "Reminder turned off");
    } catch { toast.error("Could not update reminder"); }
  };

  const hasRegLink = !!(event?.external_link && event.external_link.trim());

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!user) { toast.error("Sign up to register for events"); navigate("/auth"); return; }
    if (!hasRegLink) return;
    try { await api.post(`/events/${id}/register`); }
    catch (err) { console.error("[event-detail] register track failed", err); }
    window.open(event.external_link, "_blank", "noopener,noreferrer");
  };

  if (!event) return <div className="min-h-screen bg-canvas" />;

  const status = registrationStatus(event);

  return (
    <div className="min-h-screen bg-canvas pb-16 md:pb-8">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 md:pt-6 pb-16 md:pb-0">
        {/* Banner container — relative anchor for the Clann Event ID chip.
            The chip is absolutely positioned above the banner image
            (never overlapping the image content or the share/save buttons):
            top-right on mobile, top-left on desktop. */}
        <div className={`relative${event.clann_event_id ? " pt-16" : ""}`}>
          {event.clann_event_id && (
            <div className="absolute top-0 right-0 flex flex-col items-end md:top-0 md:right-auto md:left-0 md:items-start">
              <span className="t-caption text-ink-muted font-semibold mb-1">EVENT ID</span>
              <button
                type="button"
                onClick={copyEventId}
                data-testid="event-id-chip"
                title="Copy event ID"
                className="inline-flex h-8 items-center gap-2 rounded-full border border-line bg-surface px-2 t-caption font-semibold text-ink transition-colors duration-fast ease-standard hover:border-line-input"
              >
                {event.clann_event_id}
                <Copy size={16} strokeWidth={1.75} />
              </button>
            </div>
          )}

          <div className="relative rounded-lg overflow-hidden aspect-[16/9] bg-raised">
            <EventImage event={event} size="lg" priority className="h-full w-full" />
            <div className="absolute top-4 right-4 flex gap-2">
              <button data-testid="detail-share" onClick={share} title="Share event" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors duration-fast ease-standard hover:bg-raised">
                <Share2 size={16} strokeWidth={1.75}/>
              </button>
              <button data-testid="detail-save" onClick={toggleSave} className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors duration-fast ease-standard ${saved ? "border-selected bg-selected text-on-selected" : "border-line bg-surface text-ink hover:bg-raised"}`}>
                <Bookmark size={16} strokeWidth={1.75} fill={saved ? "currentColor" : "none"}/>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 items-center rounded-md border border-line bg-chip px-3 t-body-strong text-ink">
              {event.category}
            </span>
            <span className="inline-flex h-8 items-center rounded-md border border-line bg-raised px-3 t-body-strong text-ink-2">{event.mode}</span>
          </div>
          <div>
            <span data-testid="detail-price" className={cn("inline-flex h-8 items-center rounded-md px-3 t-body-strong", priceBadgeClass(event))}>
              {priceLabel(event)}
            </span>
          </div>
        </div>

        <h1 data-testid="event-title" className="mt-3 t-h1 text-ink">
          {event.title}
        </h1>

        {/* Registration deadline status — shown before primary CTA */}
        <div
          data-testid="event-registration-status"
          className={cn("mt-4 flex items-center gap-2 t-body-strong",
            status.tone === "urgent" ? "text-danger" :
            status.tone === "muted" ? "text-ink-muted" :
            "text-ink-2"
          )}
        >
          {status.tone === "urgent" && (
            <span className="rocket-bounce inline-flex items-center gap-1"><Rocket size={16} strokeWidth={1.75} /></span>
          )}
          {status.text}
        </div>

        {/* Combined Location / Date / Timings — single container, three rows separated by dividers */}
        <div className="mt-6 w-full bg-surface border border-line rounded-lg p-4">
          {/* Location row */}
          <div className="flex items-center gap-3">
            <MapPin size={16} className="shrink-0 text-ink-muted" />
            <div className="min-w-0">
              <p className="t-caption text-ink-muted">Location</p>
              {event.location && event.location.trim() ? (
                <p className="t-body-strong text-ink">{event.location}</p>
              ) : (
                <p className="t-body text-ink-muted italic">Location to be announced</p>
              )}
            </div>
          </div>

          <div className="my-3 h-px bg-line" />

          {/* Date row */}
          <div className="flex items-center gap-3">
            <Calendar size={16} className="shrink-0 text-ink-muted" />
            <div className="min-w-0">
              <p className="t-caption text-ink-muted">Date</p>
              {event.event_date && event.event_date.trim() ? (
                <p className="t-body-strong text-ink">{formatEventDateShort(event.event_date)}</p>
              ) : (
                <p className="t-body text-ink-muted italic">Date to be announced</p>
              )}
              {event.registration_deadline && event.registration_deadline.trim() ? (
                <p className="mt-1 t-caption text-ink-muted">Register before {event.registration_deadline}</p>
              ) : (
                <p className="mt-1 t-caption text-ink-muted">Check event page for deadline</p>
              )}
            </div>
          </div>

          <div className="my-3 h-px bg-line" />

          {/* Timings row */}
          <div className="flex items-center gap-3">
            <Clock size={16} className="shrink-0 text-ink-muted" />
            <div className="min-w-0">
              <p className="t-caption text-ink-muted">Timings</p>
              {!(event.start_time && event.start_time.trim()) ? (
                <p className="t-body text-ink-muted italic">Timings to be announced</p>
              ) : !(event.end_time && event.end_time.trim()) ? (
                <p className="t-body-strong text-ink">{event.start_time}</p>
              ) : (
                <p className="t-body-strong text-ink">{event.start_time} – {event.end_time}</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="t-h3 text-ink mb-2">About This Event</h2>
          <p className="t-body text-ink-2 leading-relaxed whitespace-pre-line">{event.full_description}</p>
        </div>

        <div className="mt-6">
          <h3 className="t-label text-ink-2 mb-3">Skills You Will Learn</h3>
          <div className="flex flex-wrap gap-2">
            {event.skills && event.skills.length > 0 ? (
              event.skills.map((s) => (
                <span key={s} className="inline-flex h-8 items-center rounded-md border border-line bg-raised px-3 t-body text-ink">{s}</span>
              ))
            ) : (
              <span className="inline-flex h-8 items-center rounded-md border border-line bg-raised px-3 t-body text-ink-muted">Tags coming soon</span>
            )}
          </div>
        </div>

        <div className="mt-6">
          <h3 className="t-label text-ink-2 mb-3">Recommended For</h3>
          <div className="flex flex-wrap gap-2">
            {event.recommended_for && event.recommended_for.length > 0 ? (
              event.recommended_for.map((s) => (
                <span key={s} className="inline-flex h-8 items-center rounded-md border border-line bg-chip px-3 t-body text-ink">{s}</span>
              ))
            ) : (
              <span className="inline-flex h-8 items-center rounded-md border border-line bg-raised px-3 t-body text-ink-muted">Open to all</span>
            )}
          </div>
        </div>

        {/* Per-event WhatsApp reminder toggle (inline, above Register) */}
        <div className="mt-6 bg-surface border border-line rounded-lg p-4 flex items-center gap-4" data-testid="event-reminder-toggle-row">
          <WhatsAppIcon size={28} />
          <div className="flex-1 min-w-0">
            <p className="t-body-strong text-ink">Remind me on WhatsApp before this event</p>
            <p className="t-caption text-ink-muted mt-1">We'll ping you 24 hours before it starts.</p>
          </div>
          <Switch
            data-testid="event-reminder-switch"
            checked={remindOn}
            onCheckedChange={toggleReminder}
          />
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleRegister}
            disabled={!hasRegLink}
            title={hasRegLink ? "" : "Registration link coming soon"}
            data-testid="detail-register-btn"
            className={cn(buttonVariants({ variant: "primary", size: "lg" }), "w-full", "disabled:pointer-events-auto disabled:cursor-not-allowed")}
          >
            Register Now <ChevronRight size={20} strokeWidth={1.75}/>
          </button>
        </div>

        {related.length > 0 && (
          <div className="mt-8">
            <h2 className="t-h3 text-ink mb-4 text-left">More Events</h2>
            <div
              className="flex gap-3 overflow-x-auto scrollbar-hide pl-0 pr-4"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {related.map((r) => (
                <RelatedEventCard key={r.event_id} event={r} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Register Now bar — mobile only (hidden at md and above) */}
      <div
        data-testid="sticky-register-bar"
        className="fixed bottom-[52px] left-0 right-0 z-40 md:hidden bg-canvas border-t border-line px-4 py-3"
      >
        <div className="flex items-center gap-3">
          <p className="flex-1 min-w-0 truncate t-body-strong text-danger">
            {status.text}
          </p>
          <button
            type="button"
            onClick={handleRegister}
            disabled={!hasRegLink}
            title={hasRegLink ? "" : "Registration link coming soon"}
            data-testid="sticky-register-btn"
            className={cn(buttonVariants({ variant: "primary", size: "sm" }), "shrink-0 w-[clamp(168px,58vw,230px)]", "disabled:pointer-events-auto disabled:cursor-not-allowed")}
          >
            Register Now
          </button>
        </div>
      </div>

      <BottomTabBar />
    </div>
  );
};

export default EventDetail;
