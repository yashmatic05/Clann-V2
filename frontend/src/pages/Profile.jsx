import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import BottomTabBar from "@/components/BottomTabBar";
import {
  LogOut, Mail, Phone, MapPin, Building2, Star,
  Bookmark, Calendar, ChevronRight, Megaphone, Copy,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import WhatsAppReminderBar from "@/components/WhatsAppReminderBar";
import { priceLabel, priceBadgeClass } from "@/lib/event-utils";
import EventImage from "@/components/EventImage";
import { buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const MAX = 300;

/* ------------------------------------------------------------------ */
/* Helpers — chip colors match CompactEventCard / EventCard (R2)          */
/* ------------------------------------------------------------------ */
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
        className={`group w-[200px] h-[280px] shrink-0 flex flex-col bg-surface rounded-lg overflow-hidden border border-line hover:border-line-input transition-[border-color,opacity,transform] duration-standard ease-standard ${removing ? "opacity-0 scale-95" : ""}`}
      >
        {/* Image — fixed 100px */}
        <div className="relative h-[100px] shrink-0 overflow-hidden bg-raised">
          <EventImage event={event} size="md" className="h-full w-full" />
          {/* Filled bookmark in the selected pair → unsave confirmation */}
          <button
            type="button"
            onClick={askUnsave}
            aria-label="Remove from saved"
            title="Remove from saved"
            data-testid={`saved-unsave-btn-${index}`}
            className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border border-selected bg-selected text-on-selected transition-colors duration-fast ease-standard"
          >
            <Bookmark size={16} strokeWidth={1.75} fill="currentColor" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 p-2 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className={`${chipClass} ${categoryColor(event.category)}`}>
              {event.category}
            </span>
            <span className={`${chipClass} ${priceBadgeClass(event)}`}>
              {priceLabel(event)}
            </span>
          </div>

          <h3 className="t-caption font-bold text-ink line-clamp-2">
            {event.title}
          </h3>

          <p className="flex items-center gap-1 t-caption text-ink-2 truncate">
            <MapPin size={16} strokeWidth={1.75} className="text-ink-muted shrink-0" />
            <span className="truncate">
              {event.city}{event.location ? ` | ${event.location.split(",")[0]}` : ""}
            </span>
          </p>

          <p className="flex items-center gap-1 t-caption text-ink-2 truncate">
            <Calendar size={16} strokeWidth={1.75} className="text-ink-muted shrink-0" />
            <span className="truncate">{displayDate}</span>
          </p>

          <p className={cn("t-caption font-semibold truncate",
            status.tone === "urgent" ? "text-danger" :
            status.tone === "muted" ? "text-ink-muted" :
            "text-ink-2"
          )}>
            {status.text}
          </p>

          <button
            type="button"
            onClick={handleRegister}
            disabled={!hasRegLink}
            title={hasRegLink ? "" : "Registration link coming soon"}
            data-testid={`saved-register-btn-${index}`}
            className={cn(buttonVariants({ variant: "primary", size: "sm" }), "mt-auto w-full", "disabled:pointer-events-auto disabled:cursor-not-allowed")}
          >
            Register <ChevronRight size={16} strokeWidth={1.75} />
          </button>
        </div>
      </Link>

      {confirmOpen && (
        <div className="fixed inset-0 z-40 bg-scrim/60 flex items-center justify-center p-4" data-testid="saved-unsave-confirm">
          <div className="relative z-50 bg-surface border border-line rounded-lg p-6 max-w-sm w-full shadow-elev-2">
            <h3 className="t-h3 text-ink">Remove from saved list?</h3>
            <p className="mt-1 t-body text-ink-2">You can save this event again later.</p>
            <div className="mt-4 flex gap-3">
              <button onClick={() => setConfirmOpen(false)} data-testid="saved-unsave-cancel" className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "flex-1")}>Cancel</button>
              <button onClick={confirmRemove} data-testid="saved-unsave-confirm-btn" className={cn(buttonVariants({ variant: "destructive", size: "sm" }), "flex-1")}>Yes, Remove</button>
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
  const [myEvents, setMyEvents] = useState([]);
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

  useEffect(() => {
    if (loading || !user) return;
    (async () => {
      try {
        const { data } = await api.get("/submissions/mine");
        setMyEvents(data);
      } catch (err) { console.error("[profile] load organized events failed", err); }
    })();
  }, [user, loading]);

  if (!loading && !user) { return null; }
  if (!user) return <div className="min-h-screen bg-canvas"/>;

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
    <div className="min-h-screen bg-canvas pb-16">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* 1. User Details */}
        <div className="bg-surface border border-line rounded-lg p-6" data-testid="profile-card">
          <div className="flex items-center gap-4">
            {user.picture ? (
              <img src={user.picture} alt={user.name} className="h-16 w-16 rounded-full border-2 border-line" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-raised flex items-center justify-center text-ink t-h2">{user.name?.[0]?.toUpperCase() || "U"}</div>
            )}
            <div>
              <h1 className="t-h1 text-ink">{user.name}</h1>
              <span className="mt-1 inline-flex h-6 items-center rounded-md border border-line bg-chip px-2 t-caption font-bold text-ink">{user.role || "attendee"}</span>
            </div>
          </div>

          <div className="mt-6 space-y-3">
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
          <h2 className="t-h3 text-ink">Notifications</h2>
          <div className="mx-[-1rem] sm:mx-[-1.5rem]">
            <WhatsAppReminderBar />
          </div>
        </div>

        {/* 2. Saved Events — horizontal scroll of compact cards */}
        <div className="bg-surface border border-line rounded-lg p-6" data-testid="profile-saved-section">
          <div className="flex items-center gap-2 mb-4">
            <Bookmark size={20} strokeWidth={1.75} className="text-ink-muted"/>
            <h2 className="t-h2 text-ink">Saved Events</h2>
            <span className="ml-auto t-caption text-ink-muted" data-testid="profile-saved-count">{saved.length}</span>
          </div>

          {saved.length === 0 ? (
            <div className="py-8 text-center" data-testid="profile-saved-empty">
              <p className="t-body-strong text-ink">No saved events yet</p>
              <p className="t-caption text-ink-muted mt-1">Bookmark events from the home page to see them here.</p>
              <Link to="/" data-testid="profile-browse-btn" className={cn(buttonVariants({ variant: "primary", size: "sm" }), "mt-4")}>
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

        {/* My Organized Events */}
        <div className="bg-surface border border-line rounded-lg p-6" data-testid="profile-organized-section">
          <div className="flex items-center gap-2 mb-4">
            <Megaphone size={20} strokeWidth={1.75} className="text-ink-muted"/>
            <h2 className="t-h2 text-ink">My Organized Events</h2>
            <Link to="/organizer" className="ml-auto t-caption font-bold text-cta-text hover:underline transition-colors duration-fast ease-standard">
              + Submit New
            </Link>
          </div>
          {myEvents.length === 0 ? (
            <div className="py-8 text-center" data-testid="profile-organized-empty">
              <p className="t-body-strong text-ink">No events submitted yet</p>
              <p className="t-caption text-ink-muted mt-1">Hosting something? List it and track its review status here.</p>
            </div>
          ) : (
            <div className="space-y-3" data-testid="profile-organized-list">
              {myEvents.map((s) => (
                <div key={s.submission_id} className="bg-canvas border border-line rounded-lg p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="t-body-strong text-ink">{s.title}</span>
                    <span className={cn("inline-flex h-6 items-center rounded-full border px-2 t-caption font-bold",
                      s.status === "pending" ? "bg-raised text-ink-2 border-line-input"
                      : s.status === "approved" ? "bg-ok-bg text-ok border-ok"
                      : "bg-danger-bg text-danger border-danger"
                    )}>
                      {s.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 t-caption text-ink-muted font-mono">
                    {s.submission_id}
                    <button
                      type="button"
                      onClick={async () => {
                        try { await navigator.clipboard.writeText(s.submission_id); toast.success("Submission ID copied"); }
                        catch { toast.error("Failed to copy"); }
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-raised hover:text-ink transition-colors duration-fast ease-standard"
                      aria-label="Copy submission ID"
                    >
                      <Copy size={16} strokeWidth={1.75} />
                    </button>
                  </div>
                  {s.status === "approved" && s.created_event_id && (
                    <Link to={`/event/${s.created_event_id}`} className="mt-2 inline-block t-caption font-bold text-ok hover:underline transition-colors duration-fast ease-standard">
                      View live event →
                    </Link>
                  )}
                  {s.status === "rejected" && s.reject_reason && (
                    <p className="mt-2 t-caption text-ink-muted">Reason: <span className="text-ink">{s.reject_reason}</span></p>
                  )}
                  {s.admin_note && (
                    <p className="mt-2 t-caption text-ink-2">Note from Clann team: <span className="text-ink">{s.admin_note}</span></p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Feedback */}
        <div className="bg-surface border border-line rounded-lg p-6" data-testid="feedback-section">
          <h2 className="t-h2 text-ink">How's your Clann experience?</h2>
          <p className="mt-1 t-body text-ink-muted">Your feedback helps us improve. Takes less than a minute.</p>

          {sent ? (
            <div data-testid="feedback-success" className="mt-6 bg-ok-bg border border-ok rounded-lg p-4 text-center">
              <p className="t-body-strong text-ink">Thank you! Your feedback means a lot to us. 🙏</p>
              <button onClick={() => setSent(false)} className="mt-3 t-caption font-bold text-cta-text underline transition-colors duration-fast ease-standard">Share more feedback</button>
            </div>
          ) : (
            <>
              <div className="mt-4 flex gap-2" data-testid="star-rating">
                {[1,2,3,4,5].map((n) => (
                  <button
                    key={n}
                    data-testid={`star-${n}`}
                    onClick={() => setRating(n)}
                    className="flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-fast ease-standard hover:bg-raised"
                    aria-label={`${n} stars`}
                  >
                    <Star size={28} strokeWidth={1.75} className={n <= rating ? "text-cta" : "text-line-input"} fill={n <= rating ? "currentColor" : "none"}/>
                  </button>
                ))}
              </div>
              <Textarea
                data-testid="feedback-text"
                rows={4}
                maxLength={MAX}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Tell us what you love, what's missing, or what we can do better..."
                className="mt-4 resize-y"
              />
              <div className="mt-1 text-right t-caption text-ink-muted" data-testid="feedback-counter">{text.length} / {MAX}</div>
              <button
                data-testid="feedback-submit"
                onClick={submitFeedback}
                disabled={busy}
                className={cn(buttonVariants({ variant: "primary", size: "md" }), "mt-3 w-full")}
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
            className={cn(buttonVariants({ variant: "secondary", size: "md" }), "w-full")}
          >
            <LogOut size={16} strokeWidth={1.75}/> Logout
          </button>
        </div>
      </div>
      <BottomTabBar/>
    </div>
  );
};

const Row = ({ Icon, label, value, testid }) => (
  <div data-testid={testid} className="flex items-center gap-3 bg-canvas rounded-lg px-4 py-3 border border-line">
    <Icon size={16} strokeWidth={1.75} className="text-ink-muted"/>
    <div className="flex-1">
      <div className="t-caption font-bold text-ink-muted">{label}</div>
      <div className="t-body text-ink break-all">{value}</div>
    </div>
  </div>
);

export default Profile;
