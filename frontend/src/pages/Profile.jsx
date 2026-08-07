import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import BottomTabBar from "@/components/BottomTabBar";
import {
  LogOut, Mail, Phone, MapPin, Building2, Star,
  Bookmark, Calendar, ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import WhatsAppReminderBar from "@/components/WhatsAppReminderBar";

const MAX = 300;

/* ------------------------------------------------------------------ */
/* Helpers — identical logic/colors to CompactEventCard / EventCard    */
/* ------------------------------------------------------------------ */
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

const parseDate = (s) => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const daysBetween = (a, b) => {
  const MS = 24 * 60 * 60 * 1000;
  const aa = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bb = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((aa - bb) / MS);
};

const formatDate = (d) => {
  if (!d) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const registrationStatus = (event) => {
  const today = new Date();
  const eventDate = parseDate(event.event_date);
  const deadline = parseDate(event.registration_deadline) || eventDate;
  if (!deadline) return { text: "Date TBA", tone: "muted" };
  const diff = daysBetween(deadline, today);
  if (diff < 0) return { text: "Registration closed", tone: "muted" };
  if (diff === 0) return { text: "Closes today", tone: "urgent" };
  if (diff === 1) return { text: "1 Day Left", tone: "urgent" };
  if (diff <= 7) return { text: `${diff} Days Left`, tone: "urgent" };
  return { text: `Register before ${formatDate(deadline)}`, tone: "normal" };
};

/* ------------------------------------------------------------------ */
/* SavedEventCard — exact compact design from Home horizontal rows,    */
/* but bookmark triggers the existing unsave confirmation flow.        */
/* ------------------------------------------------------------------ */
const SavedEventCard = ({ event, index = 0, onUnsave }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [removing, setRemoving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const askUnsave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmOpen(true);
  };

  const confirmRemove = async () => {
    try {
      await api.delete(`/events/${event.event_id}/save`);
      setRemoving(true);
      toast.success("Event removed from saved list");
      setTimeout(() => { onUnsave?.(event.event_id); }, 320);
    } catch {
      toast.error("Could not remove");
    }
    setConfirmOpen(false);
  };

  const hasRegLink = !!(event.external_link && event.external_link.trim());

  const handleRegister = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { toast.error("Sign up to register for events"); navigate("/auth"); return; }
    if (!hasRegLink) return;
    try { await api.post(`/events/${event.event_id}/register`); }
    catch (err) { console.error("[saved-card] register track failed", err); }
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
    <>
      <Link
        to={`/event/${event.event_id}`}
        data-testid={`saved-compact-card-${index}`}
        className={`group w-[200px] h-[280px] shrink-0 flex flex-col bg-[#18002C] rounded-xl overflow-hidden border border-[#46176D]/30 hover:border-[#46176D] transition-[border-color,opacity,transform] duration-300 ${removing ? "opacity-0 scale-95" : ""}`}
      >
        {/* Image — fixed 100px */}
        <div className="relative h-[100px] shrink-0 overflow-hidden bg-[#280049]">
          <img
            src={event.image_url}
            alt={event.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {/* Filled-orange bookmark → unsave confirmation */}
          <button
            type="button"
            onClick={askUnsave}
            aria-label="Remove from saved"
            title="Remove from saved"
            data-testid={`saved-unsave-btn-${index}`}
            className="absolute top-2 right-2 p-[6px] rounded-full bg-black/50 text-[#F84E00] transition-colors"
          >
            <Bookmark size={12} fill="currentColor" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 p-3 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase whitespace-nowrap ${categoryColor(event.category)}`}>
              {event.category}
            </span>
            <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold whitespace-nowrap ${event.is_paid ? "border border-[#F84E00] text-[#F84E00]" : "bg-emerald-500/15 text-emerald-300 border border-emerald-400/40"}`}>
              {event.is_paid ? `Paid ${event.price || ""}`.trim() : "Free"}
            </span>
          </div>

          <h3 className="text-xs font-bold text-white tracking-tight leading-snug line-clamp-2">
            {event.title}
          </h3>

          <p className="flex items-center gap-1 text-[10px] text-white/80 truncate">
            <MapPin size={10} className="text-[#BF72FF] shrink-0" />
            <span className="truncate">
              {event.city}{event.location ? ` | ${event.location.split(",")[0]}` : ""}
            </span>
          </p>

          <p className="flex items-center gap-1 text-[10px] text-white/80 truncate">
            <Calendar size={10} className="text-[#BF72FF] shrink-0" />
            <span className="truncate">{displayDate}</span>
          </p>

          <p className={`text-[10px] font-semibold truncate ${
            status.tone === "urgent" ? "text-[#F84E00]" :
            status.tone === "muted" ? "text-[#727272]" :
            "text-[#BF72FF]"
          }`}>
            {status.text}
          </p>

          <button
            type="button"
            onClick={handleRegister}
            disabled={!hasRegLink}
            title={hasRegLink ? "" : "Registration link coming soon"}
            data-testid={`saved-register-btn-${index}`}
            className="mt-auto w-full inline-flex items-center justify-center gap-1 bg-[#F84E00] hover:bg-[#D14200] active:bg-[#C63E00] disabled:bg-[#2C2C2C] disabled:text-[#727272] disabled:cursor-not-allowed text-white rounded-full px-3 py-2 text-[11px] font-bold transition-colors whitespace-nowrap"
          >
            Register <ChevronRight size={11} />
          </button>
        </div>
      </Link>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" data-testid="saved-unsave-confirm">
          <div className="bg-[#18002C] border border-[#46176D] rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-white">Remove from saved list?</h3>
            <p className="mt-1 text-sm text-[#727272]">You can save this event again later.</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirmOpen(false)} data-testid="saved-unsave-cancel" className="flex-1 bg-[#280049] hover:bg-[#46176D] text-[#BF72FF] rounded-full px-4 py-2.5 text-sm font-bold transition-colors">Cancel</button>
              <button onClick={confirmRemove} data-testid="saved-unsave-confirm-btn" className="flex-1 bg-[#F84E00] hover:bg-[#D14200] text-white rounded-full px-4 py-2.5 text-sm font-bold transition-colors">Yes, Remove</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Profile page                                                        */
/* ------------------------------------------------------------------ */
const Profile = () => {
  const { user, loading, logout, checkAuth } = useAuth();
  const navigate = useNavigate();

  const [saved, setSaved] = useState([]);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  // Ensure freshest user (fetches phone/city again from DB on every visit)
  useEffect(() => {
    if (!loading && user) { checkAuth?.(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth"); return; }
    (async () => {
      try {
        const { data } = await api.get("/saved");
        setSaved(data);
      } catch (err) { console.error("[profile] load saved failed", err); }
    })();
  }, [user, loading, navigate]);

  if (!loading && !user) { return null; }
  if (!user) return <div className="min-h-screen bg-[#0D0D0D]"/>;

  const removeSaved = (id) => setSaved((prev) => prev.filter((e) => e.event_id !== id));

  const submitFeedback = async () => {
    if (rating < 1) { toast.error("Please pick a star rating"); return; }
    setBusy(true);
    try {
      await api.post("/feedback", { star_rating: rating, feedback_text: text.slice(0, MAX) });
      setSent(true);
      setRating(0); setText("");
    } catch { toast.error("Could not send feedback"); }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-[#0D0D0D] pb-32 md:pb-16">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* 1. User Details */}
        <div className="bg-[#18002C] border border-[#46176D]/30 rounded-2xl p-6" data-testid="profile-card">
          <div className="flex items-center gap-4">
            {user.picture ? (
              <img src={user.picture} alt={user.name} className="w-16 h-16 rounded-full border-2 border-[#46176D]" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[#46176D] flex items-center justify-center text-white text-2xl font-black">{user.name?.[0]?.toUpperCase() || "U"}</div>
            )}
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">{user.name}</h1>
              <span className="inline-block mt-1 bg-[#280049] text-[#BF72FF] rounded-lg px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest">{user.role || "attendee"}</span>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm">
            <Row testid="profile-email" Icon={Mail} label="Email" value={user.email || "—"}/>
            <Row testid="profile-phone" Icon={Phone} label="Phone" value={user.phone || "—"}/>
            <Row testid="profile-city" Icon={MapPin} label="City" value={user.city || "—"}/>
            {user.role === "organizer" && (
              <Row Icon={Building2} label="Organisation" value={user.org_name || "—"}/>
            )}
          </div>
        </div>

        {/* Notifications Section */}
        <div className="space-y-3">
          <h2 className="text-[16px] font-bold text-white">Notifications</h2>
          <div className="mx-[-1rem] sm:mx-[-1.5rem]">
            <WhatsAppReminderBar />
          </div>
        </div>

        {/* 2. Saved Events — horizontal scroll of compact cards */}
        <div className="bg-[#18002C] border border-[#46176D]/30 rounded-2xl p-6" data-testid="profile-saved-section">
          <div className="flex items-center gap-2 mb-4">
            <Bookmark className="text-[#F84E00]" size={18}/>
            <h2 className="text-xl font-black text-white tracking-tight">Saved Events</h2>
            <span className="ml-auto text-xs text-[#727272]" data-testid="profile-saved-count">{saved.length}</span>
          </div>

          {saved.length === 0 ? (
            <div className="py-8 text-center" data-testid="profile-saved-empty">
              <p className="text-white font-bold">No saved events yet</p>
              <p className="text-xs text-[#727272] mt-1">Bookmark events from the home page to see them here.</p>
              <Link to="/" data-testid="profile-browse-btn" className="inline-block mt-4 bg-[#F84E00] hover:bg-[#D14200] text-white rounded-full px-5 py-2.5 text-xs font-bold transition-colors">
                Browse Events
              </Link>
            </div>
          ) : (
            <div
              data-testid="profile-saved-row"
              className="-mx-6 flex gap-3 overflow-x-auto scrollbar-hide [-webkit-overflow-scrolling:touch] px-4 pb-1"
            >
              {saved.map((ev, i) => (
                <SavedEventCard
                  key={ev.event_id}
                  event={ev}
                  index={i}
                  onUnsave={removeSaved}
                />
              ))}
            </div>
          )}
        </div>

        {/* 3. Feedback */}
        <div className="bg-[#18002C] border border-[#46176D]/30 rounded-2xl p-6" data-testid="feedback-section">
          <h2 className="text-xl font-black text-white tracking-tight">How's your Clann experience?</h2>
          <p className="mt-1 text-sm text-[#727272]">Your feedback helps us improve. Takes less than a minute.</p>

          {sent ? (
            <div data-testid="feedback-success" className="mt-6 bg-emerald-500/10 border border-emerald-400/30 rounded-xl p-5 text-center">
              <p className="text-white font-bold">Thank you! Your feedback means a lot to us. 🙏</p>
              <button onClick={() => setSent(false)} className="mt-3 text-xs text-[#BF72FF] hover:text-white transition-colors underline">Share more feedback</button>
            </div>
          ) : (
            <>
              <div className="mt-5 flex gap-2" data-testid="star-rating">
                {[1,2,3,4,5].map((n) => (
                  <button
                    key={n}
                    data-testid={`star-${n}`}
                    onClick={() => setRating(n)}
                    className="p-1 transition-transform hover:scale-110"
                    aria-label={`${n} stars`}
                  >
                    <Star size={28} className={n <= rating ? "text-[#F84E00]" : "text-[#46176D]"} fill={n <= rating ? "currentColor" : "none"}/>
                  </button>
                ))}
              </div>
              <textarea
                data-testid="feedback-text"
                rows={4}
                maxLength={MAX}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Tell us what you love, what's missing, or what we can do better..."
                className="mt-4 w-full bg-[#0D0D0D] border border-[#46176D]/40 focus:border-[#F84E00] rounded-lg px-4 py-3 text-sm text-white placeholder-[#727272] outline-none resize-y transition-colors"
              />
              <div className="mt-1 text-right text-[11px] text-[#727272]" data-testid="feedback-counter">{text.length} / {MAX}</div>
              <button
                data-testid="feedback-submit"
                onClick={submitFeedback}
                disabled={busy}
                className="mt-3 w-full bg-[#F84E00] hover:bg-[#D14200] disabled:opacity-60 text-white rounded-full px-5 py-3 font-bold text-sm transition-colors"
              >
                {busy ? "Sending..." : "Send Feedback"}
              </button>
            </>
          )}
        </div>

        {/* 4. Logout (bottom-most) */}
        <div className="pt-2">
          <button
            data-testid="profile-logout"
            onClick={async () => { await logout(); navigate("/"); }}
            className="w-full bg-[#280049] hover:bg-[#46176D] text-white rounded-full px-5 py-3.5 font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors border border-[#46176D]/60"
          >
            <LogOut size={16}/> Logout
          </button>
        </div>
      </div>
      <BottomTabBar/>
    </div>
  );
};

const Row = ({ Icon, label, value, testid }) => (
  <div data-testid={testid} className="flex items-center gap-3 bg-[#0D0D0D] rounded-lg px-4 py-3 border border-[#46176D]/30">
    <Icon size={14} className="text-[#BF72FF]"/>
    <div className="flex-1">
      <div className="text-[10px] uppercase tracking-widest font-bold text-[#BF72FF]">{label}</div>
      <div className="text-white break-all">{value}</div>
    </div>
  </div>
);

export default Profile;
