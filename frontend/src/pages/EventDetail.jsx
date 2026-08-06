import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import BottomTabBar from "@/components/BottomTabBar";
import EventCard from "@/components/EventCard";
import { MapPin, Calendar, Clock, Copy, Bookmark, ChevronRight, ChevronLeft, MessageCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { registrationStatus } from "@/lib/event-utils";

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
        setRelated(all.filter((e) => e.event_id !== id).slice(0, 3));
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
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied!");
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <button data-testid="back-btn" onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-[#BF72FF] hover:text-white text-sm mb-4 transition-colors">
          <ChevronLeft size={16}/> Back
        </button>

        {/* Clann Event ID chip — top right, above the banner image */}
        {event.clann_event_id && (
          <div className="flex flex-col items-end mb-3">
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
            <button data-testid="detail-share" onClick={share} title="Copy link" className="p-2.5 rounded-full bg-black/50 backdrop-blur hover:bg-[#F84E00] text-white transition-colors">
              <Copy size={16}/>
            </button>
            <button data-testid="detail-save" onClick={toggleSave} className={`p-2.5 rounded-full backdrop-blur transition-colors ${saved ? "bg-[#F84E00] text-white" : "bg-black/50 hover:bg-[#46176D] text-white"}`}>
              <Bookmark size={16} fill={saved ? "currentColor" : "none"}/>
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <span className="bg-[#46176D]/60 text-[#BF72FF] border border-[#BF72FF]/40 rounded-lg px-3 py-1 text-xs font-bold tracking-widest uppercase">
            {event.category}
          </span>
          <span className={`rounded-lg px-3 py-1 text-xs font-bold ${event.is_paid ? "border border-[#F84E00] text-[#F84E00]" : "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"}`}>
            {event.is_paid ? `Paid ${event.price || ""}`.trim() : "Free"}
          </span>
          <span className="bg-[#280049] text-[#BF72FF] rounded-lg px-3 py-1 text-xs font-bold uppercase tracking-wider">{event.mode}</span>
        </div>

        <h1 data-testid="event-title" className="mt-3 text-3xl sm:text-5xl font-black text-white tracking-tighter leading-none">
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

        <div className="mt-4 grid sm:grid-cols-3 gap-3 text-sm">
          <div className="bg-[#18002C] border border-[#46176D]/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-[#BF72FF] text-xs uppercase font-bold tracking-widest"><MapPin size={13}/> Location</div>
            <p className="mt-1 text-white font-medium">{event.location}</p>
          </div>
          <div className="bg-[#18002C] border border-[#46176D]/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-[#BF72FF] text-xs uppercase font-bold tracking-widest"><Calendar size={13}/> Date</div>
            <p className="mt-1 text-white font-medium">{event.event_date}</p>
            <p className="text-xs text-[#727272] mt-1">Register before {event.registration_deadline}</p>
          </div>
          <div className="bg-[#18002C] border border-[#46176D]/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-[#BF72FF] text-xs uppercase font-bold tracking-widest"><Clock size={13}/> Timings</div>
            <p className="mt-1 text-white font-medium">{event.start_time} – {event.end_time}</p>
          </div>
        </div>

        <div className="mt-6 bg-[#18002C] border border-[#46176D]/30 rounded-xl p-5">
          <h2 className="text-lg font-bold text-white mb-2">About This Event</h2>
          <p className="text-sm text-[#FFFBE9]/70 leading-relaxed whitespace-pre-line">{event.full_description}</p>
        </div>

        {event.skills?.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#BF72FF] mb-3">Skills You Will Learn</h3>
            <div className="flex flex-wrap gap-2">
              {event.skills.map((s) => (
                <span key={s} className="bg-[#280049] text-white rounded-lg px-3 py-1.5 text-xs font-medium border border-[#46176D]/50">{s}</span>
              ))}
            </div>
          </div>
        )}

        {event.recommended_for?.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#BF72FF] mb-3">Recommended For</h3>
            <div className="flex flex-wrap gap-2">
              {event.recommended_for.map((s) => (
                <span key={s} className="bg-[#46176D]/40 text-[#BF72FF] rounded-lg px-3 py-1.5 text-xs font-medium border border-[#BF72FF]/30">{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Per-event WhatsApp reminder toggle (inline, above Register) */}
        <div className="mt-6 bg-[#18002C] border border-[#46176D]/30 rounded-xl p-5 flex items-center gap-4" data-testid="event-reminder-toggle-row">
          <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
            <MessageCircle size={18}/>
          </div>
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

        <div className="mt-4">
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
          <div className="mt-14">
            <h2 className="text-2xl font-bold text-white mb-5 tracking-tight">More Events</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {related.map((r, i) => (
                <EventCard key={r.event_id} event={r} index={100+i} />
              ))}
            </div>
          </div>
        )}
      </div>
      <BottomTabBar />
    </div>
  );
};

export default EventDetail;
