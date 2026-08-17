import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Copy,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Search as SearchIcon,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import BottomTabBar from "@/components/BottomTabBar";
import Footer from "@/components/Footer";

const CATEGORIES = ["Workshop", "Meetup", "Hackathon", "Conference", "Walk", "Art & Sketch"];
const CITIES = ["Delhi", "Mumbai", "Bangalore", "Pune", "Other"];
const MODES = ["Online", "Offline", "Both"];

const emptyForm = {
  organizer_name: "",
  organizer_email: "",
  organizer_phone: "",
  title: "",
  category: "Workshop",
  mode: "Offline",
  short_description: "",
  full_description: "",
  image_url: "",
  location: "",
  city: "Delhi",
  event_date: "",
  start_time: "10:00",
  end_time: "13:00",
  registration_deadline: "",
  is_paid: false,
  price: "",
  total_seats: "",
  external_link: "",
  notes: "",
};

const STATUS_LABELS = {
  pending: { text: "Pending review", cls: "bg-amber-400/10 text-amber-400 border-amber-400/30" },
  approved: { text: "Approved — live on Clann", cls: "bg-emerald-400/10 text-emerald-400 border-emerald-400/30" },
  rejected: { text: "Rejected", cls: "bg-red-400/10 text-red-400 border-red-400/30" },
};

const OrganizerSubmit = () => {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null); // {submission_id, ...} from POST /api/submissions
  const [trackId, setTrackId] = useState("");
  const [trackEmail, setTrackEmail] = useState("");
  const [tracking, setTracking] = useState(false);
  const [trackResult, setTrackResult] = useState(null); // {status, title, reject_reason, ...}
  const [trackError, setTrackError] = useState("");

  // Pre-fill the tracker from the last successful submission (survives back-navigation).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("clann_last_submission") || "null");
      if (saved && saved.submission_id && saved.organizer_email) {
        setTrackId(saved.submission_id);
        setTrackEmail(saved.organizer_email);
      }
    } catch {}
  }, []);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const submit = async () => {
    const nextErrors = {};
    if (!form.organizer_name.trim()) nextErrors.organizer_name = "Your name is required";
    if (!form.organizer_email.trim()) {
      nextErrors.organizer_email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+.[^\s@]+$/.test(form.organizer_email.trim())) {
      nextErrors.organizer_email = "Enter a valid email address";
    }
    if (!form.title.trim()) nextErrors.title = "Event title is required";
    if (!form.short_description.trim()) nextErrors.short_description = "Short description is required";
    if (!form.event_date) nextErrors.event_date = "Event date is required";
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error("Please fix the highlighted fields");
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        price: form.is_paid && form.price ? String(form.price).trim() : null,
        total_seats: Number(form.total_seats) || 0,
      };
      const { data } = await api.post("/submissions", payload);
      setSubmitted(data);
      setTrackId(data.submission_id);
      setTrackEmail(data.organizer_email);
      setTrackResult(null);
      setTrackError("");
      try {
        localStorage.setItem("clann_last_submission", JSON.stringify({
          submission_id: data.submission_id,
          organizer_email: data.organizer_email,
        }));
      } catch {}
      toast.success("Submission received — our team will review it");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(detail ? (typeof detail === "string" ? detail : "Please check your submission") : "Submission failed — please try again");
    } finally {
      setSubmitting(false);
    }
  };

  const track = async () => {
    if (!trackId.trim() || !trackEmail.trim()) {
      setTrackError("Enter your submission ID and email");
      return;
    }
    setTracking(true);
    setTrackError("");
    setTrackResult(null);
    try {
      const { data } = await api.get(`/submissions/${encodeURIComponent(trackId.trim())}/status`, {
        params: { email: trackEmail.trim() },
      });
      setTrackResult(data);
    } catch (err) {
      if (err.response?.status === 404) {
        setTrackError("No submission found for that ID + email combination.");
      } else {
        setTrackError("Could not check status right now. Please try again.");
      }
    } finally {
      setTracking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0D0D] pb-24 md:pb-6 overflow-x-hidden max-w-full">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 md:pt-14">
        {/* Hero */}
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">List Your Event on Clann</h1>
          <p className="text-sm text-[#727272] mt-2 max-w-xl">
            Tell us about your event — our team reviews every submission before it goes live.
          </p>
        </div>

        {submitted ? (
          /* -------- Success state -------- */
          <div data-testid="submission-success" className="mt-8 rounded-2xl border border-emerald-400/30 bg-[#18002C] p-6 md:p-8">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-emerald-400" size={28} />
              <h2 className="text-xl font-black text-white tracking-tight">Submission received!</h2>
            </div>
            <p className="text-sm text-[#727272] mt-3">
              <span className="text-white font-bold">"{submitted.title}"</span> is now in our review queue.
              You'll find it in the admin approval queue as pending.
            </p>
            <div className="mt-4 rounded-xl bg-[#0D0D0D] border border-[#46176D]/40 p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-widest text-[#BF72FF] font-bold">Your submission ID</div>
                <div className="flex items-center gap-2 mt-1">
                  <div data-testid="submission-id" className="text-white font-mono text-sm">{submitted.submission_id}</div>
                  <button
                    type="button"
                    data-testid="copy-submission-id"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(submitted.submission_id);
                        toast.success("Submission ID copied");
                      } catch { toast.error("Failed to copy"); }
                    }}
                    className="text-[#BF72FF] hover:text-white transition-colors"
                    aria-label="Copy submission ID"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
              <div className="text-[11px] text-[#727272] sm:text-right">
                Save this ID + your email to check status below.
              </div>
            </div>
            <button
              data-testid="submit-another-btn"
              onClick={() => { setSubmitted(null); setForm(emptyForm); }}
              className="mt-4 text-xs font-bold uppercase tracking-widest text-[#BF72FF] hover:text-white transition-colors"
            >
              + Submit another event
            </button>
          </div>
        ) : (
          /* -------- Form -------- */
          <div className="mt-8 bg-[#18002C] border border-[#46176D]/40 rounded-2xl p-5 sm:p-7 space-y-5">
            <h2 className="text-lg font-black text-white tracking-tight">Organizer details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Your Name *" error={errors.organizer_name}>
                <input data-testid="org-name" value={form.organizer_name} onChange={set("organizer_name")} placeholder="e.g. Ananya Sharma" className={errors.organizer_name ? inputErrorCls : inputCls} />
              </Field>
              <Field label="Email *" error={errors.organizer_email}>
                <input data-testid="org-email" type="email" value={form.organizer_email} onChange={set("organizer_email")} placeholder="you@example.com" className={errors.organizer_email ? inputErrorCls : inputCls} />
              </Field>
              <Field label="Phone (optional)">
                <input data-testid="org-phone" value={form.organizer_phone} onChange={set("organizer_phone")} placeholder="+91 98765 43210" className={inputCls} />
              </Field>
            </div>

            <hr className="border-[#46176D]/30" />

            <h2 className="text-lg font-black text-white tracking-tight">Event details</h2>
            <Field label="Event Title *" error={errors.title}>
              <input data-testid="sub-title" value={form.title} onChange={set("title")} placeholder="e.g. Design Thinking Bootcamp" className={errors.title ? inputErrorCls : inputCls} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Category">
                <SelectBox data-testid="sub-category" value={form.category} onChange={set("category")} options={CATEGORIES} />
              </Field>
              <Field label="Mode">
                <SelectBox data-testid="sub-mode" value={form.mode} onChange={set("mode")} options={MODES} />
              </Field>
            </div>
            <Field label="Short Description * (shown on the event card)" error={errors.short_description}>
              <input data-testid="sub-short" maxLength={150} value={form.short_description} onChange={set("short_description")} placeholder="One or two lines that make people want to click" className={errors.short_description ? inputErrorCls : inputCls} />
            </Field>
            <Field label="Full Description">
              <textarea data-testid="sub-full" rows={4} value={form.full_description} onChange={set("full_description")} placeholder="Agenda, speakers, takeaways…" className={`${inputCls} resize-y`} />
            </Field>
            <Field label="Event Image URL (optional — leave blank if you don't have a real event image)">
              <input data-testid="sub-image" value={form.image_url} onChange={set("image_url")} placeholder="https://example.com/event-banner.jpg" className={inputCls} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Venue / Location">
                <input data-testid="sub-location" value={form.location} onChange={set("location")} placeholder="e.g. Indiranagar, Bengaluru" className={inputCls} />
              </Field>
              <Field label="City">
                <SelectBox data-testid="sub-city" value={form.city} onChange={set("city")} options={CITIES} />
              </Field>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="Event Date *" error={errors.event_date}>
                <input data-testid="sub-date" type="date" value={form.event_date} onChange={set("event_date")} className={errors.event_date ? inputErrorCls : inputCls} />
              </Field>
              <Field label="Start">
                <input data-testid="sub-start" type="time" value={form.start_time} onChange={set("start_time")} className={inputCls} />
              </Field>
              <Field label="End">
                <input data-testid="sub-end" type="time" value={form.end_time} onChange={set("end_time")} className={inputCls} />
              </Field>
              <Field label="Reg. Deadline">
                <input data-testid="sub-deadline" type="date" value={form.registration_deadline} onChange={set("registration_deadline")} className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="flex items-center justify-between bg-[#0D0D0D] rounded-lg px-4 py-3 border border-[#46176D]/40">
                <label className="text-xs font-bold uppercase tracking-widest text-[#BF72FF]">Paid Event</label>
                <button
                  type="button"
                  data-testid="sub-paid"
                  onClick={() => setForm((f) => ({ ...f, is_paid: !f.is_paid }))}
                  className={`w-10 h-5 rounded-full transition-colors relative ${form.is_paid ? "bg-[#F84E00]" : "bg-[#46176D]"}`}
                  aria-pressed={form.is_paid}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.is_paid ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>
              {form.is_paid && (
                <Field label="Price">
                  <input data-testid="sub-price" value={form.price} onChange={set("price")} placeholder="₹299" className={inputCls} />
                </Field>
              )}
              <Field label="Total Seats">
                <input data-testid="sub-seats" type="number" min="0" value={form.total_seats} onChange={set("total_seats")} placeholder="30" className={inputCls} />
              </Field>
            </div>
            <Field label="Registration Link (optional)">
              <input data-testid="sub-link" value={form.external_link} onChange={set("external_link")} placeholder="https://…" className={inputCls} />
            </Field>
            <Field label="Anything else we should know? (optional)">
              <textarea data-testid="sub-notes" rows={3} value={form.notes} onChange={set("notes")} placeholder="Pricing details, links to past events, target audience…" className={`${inputCls} resize-y`} />
            </Field>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <button
                data-testid="submit-submission-btn"
                onClick={submit}
                disabled={submitting}
                className="flex-1 bg-[#F84E00] hover:bg-[#D14200] active:bg-[#C63E00] disabled:opacity-60 text-white rounded-full px-6 py-3 text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {submitting ? "Submitting…" : "Submit for Review"}
              </button>
              <Link
                to="/"
                className="sm:flex-none text-center text-xs font-bold uppercase tracking-widest text-[#BF72FF] hover:text-white transition-colors px-4 py-3"
              >
                ← Back to events
              </Link>
            </div>
            <p className="text-[11px] text-[#727272]">
              <Clock size={11} className="inline mr-1 -mt-0.5" />
              Submissions are usually reviewed within 2–3 days. Approved events go live automatically.
            </p>
          </div>
        )}

        {/* -------- Track your submission -------- */}
        <div className="mt-8 bg-[#18002C] border border-[#46176D]/40 rounded-2xl p-5 sm:p-7">
          <div className="flex items-center gap-2 mb-1">
            <SearchIcon size={16} className="text-[#BF72FF]" />
            <h2 className="text-lg font-black text-white tracking-tight">Check submission status</h2>
          </div>
          <p className="text-xs text-[#727272] mb-4">Use the ID you received after submitting, plus the email you submitted with.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Submission ID">
              <input data-testid="track-id-input" value={trackId} onChange={(e) => setTrackId(e.target.value)} placeholder="sub_xxxxxxxxxx" className={inputCls} />
            </Field>
            <Field label="Email">
              <input data-testid="track-email-input" type="email" value={trackEmail} onChange={(e) => setTrackEmail(e.target.value)} placeholder="you@example.com" className={inputCls} />
            </Field>
          </div>
          <button
            data-testid="track-status-btn"
            onClick={track}
            disabled={tracking}
            className="mt-4 inline-flex items-center gap-2 border border-[#46176D] text-[#BF72FF] hover:bg-[#280049] hover:text-white disabled:opacity-60 rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors"
          >
            {tracking ? <Loader2 size={13} className="animate-spin" /> : <SearchIcon size={13} />}
            {tracking ? "Checking…" : "Check status"}
          </button>

          {trackError && (
            <div data-testid="track-error" className="mt-4 rounded-xl bg-red-400/5 border border-red-400/30 px-4 py-3 text-xs text-red-300 flex items-start gap-2">
              <XCircle size={14} className="shrink-0 mt-0.5" />
              {trackError}
            </div>
          )}
          {trackResult && (
            <div data-testid="track-result" className="mt-4 rounded-xl bg-[#0D0D0D] border border-[#46176D]/40 p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-sm font-bold text-white">{trackResult.title}</span>
                <span className={`text-[10px] font-bold uppercase tracking-widest border rounded-full px-3 py-1 ${STATUS_LABELS[trackResult.status]?.cls || "bg-[#280049] text-[#BF72FF] border-[#46176D]"}`}>
                  {STATUS_LABELS[trackResult.status]?.text || trackResult.status}
                </span>
              </div>
              {trackResult.status === "approved" && trackResult.created_event_id && (
                <Link to={`/event/${trackResult.created_event_id}`} className="mt-3 inline-block text-xs font-bold text-[#BF72FF] hover:text-white transition-colors">
                  View your live event →
                </Link>
              )}
              {trackResult.status === "rejected" && trackResult.reject_reason && (
                <p className="mt-3 text-xs text-[#727272]">
                  Reason: <span className="text-white/90">{trackResult.reject_reason}</span>
                </p>
              )}
              {trackResult.admin_note && (
                <p className="mt-3 text-xs text-[#BF72FF]">
                  Note from Clann team: <span className="text-white/90">{trackResult.admin_note}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
      <BottomTabBar />
    </div>
  );
};

const inputCls = "w-full bg-[#0D0D0D] border border-[#46176D]/40 focus:border-[#F84E00] rounded-lg px-4 py-2.5 text-sm text-white placeholder-[#727272] outline-none transition-colors";
const inputErrorCls = "w-full bg-[#0D0D0D] border border-red-500 focus:border-red-400 rounded-lg px-4 py-2.5 text-sm text-white placeholder-[#727272] outline-none transition-colors";

const Field = ({ label, error, children }) => (
  <div>
    <label className="text-xs font-bold uppercase tracking-widest text-[#BF72FF] block mb-2">{label}</label>
    {children}
    {error && <p className="text-red-400 text-[11px] mt-1">{error}</p>}
  </div>
);

const SelectBox = ({ "data-testid": testid, value, onChange, options }) => (
  <select data-testid={testid} value={value} onChange={onChange} className={inputCls}>
    {options.map((o) => <option key={o} value={o} className="bg-[#0D0D0D] text-white">{o}</option>)}
  </select>
);

export default OrganizerSubmit;
