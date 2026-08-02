import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import BottomTabBar from "@/components/BottomTabBar";
import EventCard from "@/components/EventCard";
import { LogOut, Mail, Phone, MapPin, Building2, Star, Bookmark } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

const MAX = 300;

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

        {/* 2. Saved Events */}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {saved.map((ev, i) => (
                <EventCard
                  key={ev.event_id}
                  event={ev}
                  index={200 + i}
                  initialSaved={true}
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
