import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import BottomTabBar from "@/components/BottomTabBar";
import EventCard from "@/components/EventCard";
import { MapPin, Calendar, Clock, Copy, Share2, Bookmark, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { registrationStatus, priceLabel, priceBadgeClass } from "@/lib/event-utils";
import WhatsAppIcon from "@/components/WhatsAppIcon";

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

const RelatedEventCard = ({ event, savedIds }) => {
  const navigate = useNavigate();
  const status = registrationStatus(event);

  return (
    <div
      onClick={() => navigate(`/event/${event.event_id}`)}
      className="flex-shrink-0 w-[200px] h-[300px] bg-[#18002C] border border-[#46176D]/30 rounded-[12px] overflow-hidden cursor-pointer"
    >
      <img src={event.image_url} alt={event.title} className="w-full h-[100px] object-cover bg-[#280049]" />
      <div className="p-[10px] flex flex-col gap-[6px] overflow-hidden">
        {/* Row 1 */}
        <div className="flex">
          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase whitespace-nowrap ${categoryColor(event.category)}`}>
            {event.category}
          </span>
        </div>

        {/* Row 2 */}
        <h4 className="text-[12px] font-bold text-white line-clamp-2 leading-tight">
          {event.title}
        </h4>

        {/* Row 3 */}
        <p className="flex items-center gap-1 text-[10px] text-[#727272] truncate">
          <MapPin size={10} className="shrink-0 text-[#BF72FF]" />
          <span className="truncate">
            {event.city}{event.location ? ` | ${event.location.split(",")[0]}` : ""}
          </span>
        </p>

        {/* Row 4 */}
        <p className="flex items-center gap-1 text-[10px] text-[#727272] truncate">
          <Calendar size={10} className="shrink-0 text-[#BF72FF]" />
          <span>{event.event_date}</span>
        </p>

        {/* Row 5 */}
        <p className={`text-[10px] font-semibold truncate ${status.tone === "urgent" ? "text-[#F84E00]" : "text-[#727272]"}`}>
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
          className="mt-auto w-full h-[28px] bg-[#F84E00] text-white text-[11px] rounded-[20px] font-bold"
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

  if (!event) return <div className="min-h-screen bg-[#0D0D0D]" />;

  const status = registrationStatus(event);

  return (
    <div className="min-h-screen bg-[#0D0D0D] pb-24 md:pb-10">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 md:pt-6 pb-20 md:pb-0">
        {/* Banner container — relative anchor for the Clann Event ID chip.
            The chip is absolutely positioned above the banner image
            (never overlapping the image content or the share/save buttons):
            top-right on mobile, top-left on desktop. */}
        <div className={`relative${event.clann_event_id ? " pt-[58px] md:pt-[78px]" : ""}`}>
          {event.clann_event_id && (
            <div className="absolute top-0 right-0 flex flex-col items-end md:top-4 md:right-auto md:left-0 md:items-start">
              <span className="text-[10px] text-[#727272] font-semibold tracking-widest mb-1">EVENT ID</span>
              <button
                type="button"
                onClick={copyEventId}
                data-testid="event-id-chip"
                title="Copy event ID"
                className="inline-flex items-center gap-1.5 bg-[#18002C] text-[#BF72FF] border border-[#46176D] text-[11px] font-semibold px-2.5 py-1 rounded-[20px] hover:border-[#BF72FF]/50 transition-colors"
              >
                {event.clann_event_id}
                <Copy size={12} />
              </button>
            </div>
          )}

          <div className="relative rounded-2xl overflow-hidden aspect-[16/9] bg-[#18002C]">
            <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D]/90 via-transparent to-transparent" />
            <div className="absolute top-4 right-4 flex gap-2">
              <button data-testid="detail-share" onClick={share} title="Share event" className="p-2.5 rounded-full bg-black/50 backdrop-blur hover:bg-[#F84E00] text-white transition-colors">
                <Share2 size={16}/>
              </button>
              <button data-testid="detail-save" onClick={toggleSave} className={`p-2.5 rounded-full backdrop-blur transition-colors ${saved ? "bg-[#F84E00] text-white" : "bg-black/50 hover:bg-[#46176D] text-white"}`}>
                <Bookmark size={16} fill={saved ? "currentColor" : "none"}/>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="bg-[#46176D]/60 text-[#BF72FF] border border-[#BF72FF]/40 rounded-lg px-3 py-1 text-xs font-bold tracking-widest uppercase">
              {event.category}
            </span>
            <span className="bg-[#280049] text-[#BF72FF] rounded-lg px-3 py-1 text-xs font-bold uppercase tracking-wider">{event.mode}</span>
          </div>
          <div>
            <span data-testid="detail-price" className={`rounded-lg px-3 py-1 text-xs font-bold ${priceBadgeClass(event)}`}>
              {priceLabel(event)}
            </span>
          </div>
        </div>

        <h1 data-testid="event-title" className="mt-3 text-3xl sm:text-5xl font-black text-white tracking-tighter leading-[32px] sm:leading-[50px]">
          {event.title}
        </h1>

        {/* Registration deadline status — shown before primary CTA */}
        <div
          data-testid="event-registration-status"
          className={`mt-4 flex items-center gap-2 text-sm font-semibold ${
            status.tone === "urgent" ? "text-[#F84E00]" :
            status.tone === "muted" ? "text-[#727272]" :
            "text-[#BF72FF]"
          }`}
        >
          {status.tone === "urgent" && (
            <span className="rocket-bounce inline-flex items-center gap-1">🚀</span>
          )}
          {status.text}
        </div>

        {/* Combined Location / Date / Timings — single container, three rows separated by dividers */}
        <div className="mt-6 w-full bg-[#18002C] border border-[#46176D]/30 rounded-[12px] p-4">
          {/* Location row */}
          <div className="flex items-center gap-3">
            <MapPin size={16} className="shrink-0 text-[#F84E00]" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-[#727272]">Location</p>
              {event.location && event.location.trim() ? (
                <p className="text-sm text-white font-medium">{event.location}</p>
              ) : (
                <p className="text-sm text-[#727272] italic">Location to be announced</p>
              )}
            </div>
          </div>

          <div className="my-3 h-px bg-[#46176D]/20" />

          {/* Date row */}
          <div className="flex items-center gap-3">
            <Calendar size={16} className="shrink-0 text-[#F84E00]" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-[#727272]">Date</p>
              {event.event_date && event.event_date.trim() ? (
                <p className="text-sm text-white font-medium">{event.event_date}</p>
              ) : (
                <p className="text-sm text-[#727272] italic">Date to be announced</p>
              )}
              {event.registration_deadline && event.registration_deadline.trim() ? (
                <p className="mt-0.5 text-xs text-[#727272]">Register before {event.registration_deadline}</p>
              ) : (
                <p className="mt-0.5 text-xs text-[#727272]">Check event page for deadline</p>
              )}
            </div>
          </div>

          <div className="my-3 h-px bg-[#46176D]/20" />

          {/* Timings row */}
          <div className="flex items-center gap-3">
            <Clock size={16} className="shrink-0 text-[#F84E00]" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-[#727272]">Timings</p>
              {!(event.start_time && event.start_time.trim()) ? (
                <p className="text-sm text-[#727272] italic">Timings to be announced</p>
              ) : !(event.end_time && event.end_time.trim()) ? (
                <p className="text-sm text-white font-medium">{event.start_time}</p>
              ) : (
                <p className="text-sm text-white font-medium">{event.start_time} – {event.end_time}</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-lg font-bold text-white mb-2">About This Event</h2>
          <p className="text-sm text-[#FFFBE9]/70 leading-relaxed whitespace-pre-line">{event.full_description}</p>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#BF72FF] mb-3">Skills You Will Learn</h3>
          <div className="flex flex-wrap gap-2">
            {event.skills && event.skills.length > 0 ? (
              event.skills.map((s) => (
                <span key={s} className="bg-[#280049] text-white rounded-lg px-3 py-1.5 text-xs font-medium border border-[#46176D]/50">{s}</span>
              ))
            ) : (
              <span className="bg-[#280049]/40 text-[#727272] rounded-lg px-3 py-1.5 text-xs font-medium border border-[#46176D]/30">Tags coming soon</span>
            )}
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#BF72FF] mb-3">Recommended For</h3>
          <div className="flex flex-wrap gap-2">
            {event.recommended_for && event.recommended_for.length > 0 ? (
              event.recommended_for.map((s) => (
                <span key={s} className="bg-[#46176D]/40 text-[#BF72FF] rounded-lg px-3 py-1.5 text-xs font-medium border border-[#BF72FF]/30">{s}</span>
              ))
            ) : (
              <span className="bg-[#46176D]/20 text-[#727272] rounded-lg px-3 py-1.5 text-xs font-medium border border-[#BF72FF]/10">Open to all</span>
            )}
          </div>
        </div>

        {/* Per-event WhatsApp reminder toggle (inline, above Register) */}
        <div className="mt-6 bg-[#18002C] border border-[#46176D]/30 rounded-xl p-5 flex items-center gap-4" data-testid="event-reminder-toggle-row">
          <WhatsAppIcon size={28} />
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm">Remind me on WhatsApp before this event</p>
            <p className="text-[11px] text-[#727272] mt-0.5">We'll ping you 24 hours before it starts.</p>
          </div>
          <Switch
            data-testid="event-reminder-switch"
            checked={remindOn}
            onCheckedChange={toggleReminder}
            className="data-[state=checked]:bg-[#F84E00]"
          />
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleRegister}
            disabled={!hasRegLink}
            title={hasRegLink ? "" : "Registration link coming soon"}
            data-testid="detail-register-btn"
            className="w-full inline-flex items-center justify-center gap-2 bg-[#F84E00] hover:bg-[#D14200] active:bg-[#C63E00] disabled:bg-[#2C2C2C] disabled:text-[#727272] disabled:cursor-not-allowed text-white rounded-full px-6 py-4 text-base font-bold shadow-[0_0_25px_rgba(248,78,0,0.4)] disabled:shadow-none transition-colors"
          >
            Register Now <ChevronRight size={18}/>
          </button>
        </div>

        {related.length > 0 && (
          <div className="mt-8">
            <h2 className="text-[18px] font-bold text-white mb-5 text-left">More Events</h2>
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
        className="fixed bottom-[60px] left-0 right-0 z-50 md:hidden bg-[#0D0D0D] border-t border-[#46176D]/40 px-4 py-3"
      >
        <div className="flex items-center gap-3">
          <p className="flex-1 min-w-0 truncate text-[13px] font-semibold text-[#F84E00]">
            {status.text}
          </p>
          <button
            type="button"
            onClick={handleRegister}
            disabled={!hasRegLink}
            title={hasRegLink ? "" : "Registration link coming soon"}
            data-testid="sticky-register-btn"
            className="shrink-0 w-[clamp(168px,58vw,230px)] inline-flex items-center justify-center bg-[#F84E00] hover:bg-[#D14200] active:bg-[#C63E00] disabled:bg-[#2C2C2C] disabled:text-[#727272] disabled:cursor-not-allowed text-white rounded-[20px] px-5 py-2.5 text-sm font-bold transition-colors"
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
