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
import FormField from "@/components/ui/form-field";
import { Input, fieldBaseClassNames } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

// R8 status badges: always icon + word, never colour alone. There is no
// `warning` token in the design system, so R4's "amber pending becomes
// neutral bg-raised with a clock icon" is what `pending` maps to.
const STATUS_LABELS = {
  pending: { text: "Pending review", Icon: Clock, cls: "bg-raised text-ink border-line-input" },
  approved: { text: "Approved — live on Clann", Icon: CheckCircle2, cls: "bg-ok-bg text-ok border-ok" },
  rejected: { text: "Rejected", Icon: XCircle, cls: "bg-danger-bg text-danger border-danger" },
};
const STATUS_FALLBACK = { text: "", Icon: null, cls: "bg-raised text-ink-2 border-line-input" };

const StatusBadge = ({ status }) => {
  const st = STATUS_LABELS[status] || STATUS_FALLBACK;
  const Icon = st.Icon;
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-full border px-2 t-caption font-bold", st.cls)}>
      {Icon ? <Icon size={16} strokeWidth={1.75} aria-hidden="true" /> : null}
      <span>{st.text || status}</span>
    </span>
  );
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
    <div className="min-h-screen bg-canvas pb-16 md:pb-6 overflow-x-hidden max-w-full">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 md:pt-12">
        {/* Hero */}
        <div>
          <h1 className="t-h1 text-ink">List Your Event on Clann</h1>
          <p className="t-body text-ink-muted mt-2 max-w-xl">
            Tell us about your event — our team reviews every submission before it goes live.
          </p>
        </div>

        {submitted ? (
          /* -------- Success state -------- */
          <div data-testid="submission-success" className="mt-8 rounded-lg border border-ok bg-surface p-6 md:p-8">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-ok" size={24} strokeWidth={1.75} aria-hidden="true" />
              <h2 className="t-h2 text-ink">Submission received!</h2>
            </div>
            <p className="t-body text-ink-muted mt-3">
              <span className="t-body-strong text-ink">"{submitted.title}"</span> is now in our review queue.
              You'll find it in the admin approval queue as pending.
            </p>
            <div className="mt-4 rounded-lg bg-canvas border border-line p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="flex-1">
                <div className="t-label text-ink-2 font-bold">Your submission ID</div>
                <div className="flex items-center gap-2 mt-1">
                  <div data-testid="submission-id" className="t-body text-ink font-mono">{submitted.submission_id}</div>
                  <button
                    type="button"
                    data-testid="copy-submission-id"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(submitted.submission_id);
                        toast.success("Submission ID copied");
                      } catch { toast.error("Failed to copy"); }
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-raised hover:text-ink transition-colors duration-fast ease-standard"
                    aria-label="Copy submission ID"
                  >
                    <Copy size={16} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
              <div className="t-caption text-ink-muted sm:text-right">
                Save this ID + your email to check status below.
              </div>
            </div>
            <button
              data-testid="submit-another-btn"
              onClick={() => { setSubmitted(null); setForm(emptyForm); }}
              className="mt-4 t-caption font-bold text-cta-text hover:underline transition-colors duration-fast ease-standard"
            >
              List another event
            </button>
          </div>
        ) : (
          /* -------- Form -------- */
          <div className="mt-8 bg-surface border border-line rounded-lg p-4 sm:p-6 space-y-4">
            <h2 className="t-h3 text-ink">Organizer details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Your Name" required error={errors.organizer_name}>
                <Input data-testid="org-name" value={form.organizer_name} onChange={set("organizer_name")} placeholder="e.g. Ananya Sharma" />
              </FormField>
              <FormField label="Email" required error={errors.organizer_email}>
                <Input data-testid="org-email" type="email" value={form.organizer_email} onChange={set("organizer_email")} placeholder="you@example.com" />
              </FormField>
              <FormField label="Phone (optional)">
                <Input data-testid="org-phone" value={form.organizer_phone} onChange={set("organizer_phone")} placeholder="+91 98765 43210" />
              </FormField>
            </div>

            <hr className="border-line" />

            <h2 className="t-h3 text-ink">Event details</h2>
            <FormField label="Event Title" required error={errors.title}>
              <Input data-testid="sub-title" value={form.title} onChange={set("title")} placeholder="e.g. Design Thinking Bootcamp" />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Category">
                <SelectBox data-testid="sub-category" value={form.category} onChange={set("category")} options={CATEGORIES} />
              </FormField>
              <FormField label="Mode">
                <SelectBox data-testid="sub-mode" value={form.mode} onChange={set("mode")} options={MODES} />
              </FormField>
            </div>
            <FormField label="Short Description (shown on the event card)" required error={errors.short_description}>
              <Input data-testid="sub-short" maxLength={150} value={form.short_description} onChange={set("short_description")} placeholder="One or two lines that make people want to click" />
            </FormField>
            <FormField label="Full Description">
              <Textarea data-testid="sub-full" rows={4} value={form.full_description} onChange={set("full_description")} placeholder="Agenda, speakers, takeaways…" className="resize-y" />
            </FormField>
            <FormField label="Event Image URL (optional — leave blank if you don't have a real event image)">
              <Input data-testid="sub-image" value={form.image_url} onChange={set("image_url")} placeholder="https://example.com/event-banner.jpg" />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Venue / Location">
                <Input data-testid="sub-location" value={form.location} onChange={set("location")} placeholder="e.g. Indiranagar, Bengaluru" />
              </FormField>
              <FormField label="City">
                <SelectBox data-testid="sub-city" value={form.city} onChange={set("city")} options={CITIES} />
              </FormField>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <FormField label="Event Date" required error={errors.event_date}>
                <Input data-testid="sub-date" type="date" value={form.event_date} onChange={set("event_date")} />
              </FormField>
              <FormField label="Start">
                <Input data-testid="sub-start" type="time" value={form.start_time} onChange={set("start_time")} />
              </FormField>
              <FormField label="End">
                <Input data-testid="sub-end" type="time" value={form.end_time} onChange={set("end_time")} />
              </FormField>
              <FormField label="Reg. Deadline">
                <Input data-testid="sub-deadline" type="date" value={form.registration_deadline} onChange={set("registration_deadline")} />
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="flex items-center justify-between gap-4 bg-canvas rounded-lg px-4 py-3 border border-line">
                <label htmlFor="sub-paid" className="t-label text-ink-2">Paid Event</label>
                <Switch
                  id="sub-paid"
                  data-testid="sub-paid"
                  checked={form.is_paid}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_paid: v }))}
                />
              </div>
              {form.is_paid && (
                <FormField label="Price">
                  <Input data-testid="sub-price" value={form.price} onChange={set("price")} placeholder="₹299" />
                </FormField>
              )}
              <FormField label="Total Seats">
                <Input data-testid="sub-seats" type="number" min="0" value={form.total_seats} onChange={set("total_seats")} placeholder="30" />
              </FormField>
            </div>
            <FormField label="Registration Link (optional)">
              <Input data-testid="sub-link" value={form.external_link} onChange={set("external_link")} placeholder="https://…" />
            </FormField>
            <FormField label="Anything else we should know? (optional)">
              <Textarea data-testid="sub-notes" rows={3} value={form.notes} onChange={set("notes")} placeholder="Pricing details, links to past events, target audience…" className="resize-y" />
            </FormField>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <button
                data-testid="submit-submission-btn"
                onClick={submit}
                disabled={submitting}
                className={cn(buttonVariants({ variant: "primary", size: "md" }), "flex-1")}
              >
                {submitting ? <Loader2 size={16} strokeWidth={1.75} className="animate-spin" /> : <Send size={16} strokeWidth={1.75} />}
                Send for review
              </button>
              <Link
                to="/"
                className="sm:flex-none text-center t-caption font-bold text-cta-text hover:underline transition-colors duration-fast ease-standard px-4 py-3"
              >
                ← Back to events
              </Link>
            </div>
            <p className="t-caption text-ink-muted inline-flex items-start gap-2">
              <Clock size={16} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
              Submissions are usually reviewed within 2–3 days. Approved events go live automatically.
            </p>
          </div>
        )}

        {/* -------- Track your submission -------- */}
        <div className="mt-8 bg-surface border border-line rounded-lg p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-1">
            <SearchIcon size={20} strokeWidth={1.75} className="text-ink-muted" aria-hidden="true" />
            <h2 className="t-h3 text-ink">Check submission status</h2>
          </div>
          <p className="t-caption text-ink-muted mb-4">Use the ID you received after submitting, plus the email you submitted with.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Submission ID">
              <Input data-testid="track-id-input" value={trackId} onChange={(e) => setTrackId(e.target.value)} placeholder="sub_xxxxxxxxxx" />
            </FormField>
            <FormField label="Email">
              <Input data-testid="track-email-input" type="email" value={trackEmail} onChange={(e) => setTrackEmail(e.target.value)} placeholder="you@example.com" />
            </FormField>
          </div>
          <button
            data-testid="track-status-btn"
            onClick={track}
            disabled={tracking}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-4")}
          >
            {tracking ? <Loader2 size={16} strokeWidth={1.75} className="animate-spin" /> : <SearchIcon size={16} strokeWidth={1.75} />}
            Check my submission
          </button>

          {trackError && (
            <div data-testid="track-error" role="alert" className="mt-4 rounded-md bg-danger-bg border border-danger p-4 t-caption text-danger flex items-start gap-2">
              <XCircle size={16} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
              {trackError}
            </div>
          )}
          {trackResult && (
            <div data-testid="track-result" className="mt-4 rounded-lg bg-canvas border border-line p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="t-body-strong text-ink">{trackResult.title}</span>
                <StatusBadge status={trackResult.status} />
              </div>
              {trackResult.status === "approved" && trackResult.created_event_id && (
                <Link to={`/event/${trackResult.created_event_id}`} className="mt-3 inline-block t-caption font-bold text-cta-text hover:underline transition-colors duration-fast ease-standard">
                  View your live event →
                </Link>
              )}
              {trackResult.status === "rejected" && trackResult.reject_reason && (
                <p className="mt-3 t-caption text-ink-muted">
                  Reason: <span className="text-ink">{trackResult.reject_reason}</span>
                </p>
              )}
              {trackResult.admin_note && (
                <p className="mt-3 t-caption text-ink-2">
                  Note from Clann team: <span className="text-ink">{trackResult.admin_note}</span>
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

const SelectBox = ({ "data-testid": testid, value, onChange, options }) => (
  <select data-testid={testid} value={value} onChange={onChange} className={cn(fieldBaseClassNames, "h-11 px-4")}>
    {options.map((o) => <option key={o} value={o} className="bg-surface text-ink">{o}</option>)}
  </select>
);

export default OrganizerSubmit;
