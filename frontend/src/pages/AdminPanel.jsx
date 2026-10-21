import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Star, LogOut, Calendar, Users, TicketCheck, MessageSquare, Upload, FileSpreadsheet, Download, Wand2, Loader2, ClipboardList, Check, X, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as XLSX from "xlsx";
import ThemedLogo from "@/components/ThemedLogo";
import ThemeToggle from "@/components/ThemeToggle";
import FormField from "@/components/ui/form-field";
import { Input, fieldBaseClassNames } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buttonVariants } from "@/components/ui/button";
import ImageFinder from "@/components/admin/ImageFinder";
import { cn } from "@/lib/utils";

const CATEGORIES = ["Workshop", "Meetup", "Hackathon", "Conference", "Walk", "Art & Sketch"];
const CITIES = ["Delhi", "Mumbai", "Bangalore", "Pune", "Other"];
const MODES = ["Online", "Offline", "Both"];
const AUDIENCE = ["Students", "Beginners", "Professionals", "Designers", "Developers", "All"];

const emptyEvent = {
  title: "", category: "Workshop", mode: "Offline", short_description: "", full_description: "",
  image_url: "", location: "", city: "Delhi", event_date: "", start_time: "10:00", end_time: "13:00",
  registration_deadline: "", is_paid: false, price: "", total_seats: 30,
  external_link: "", skills: [], recommended_for: [], featured: false, is_government: false,
  homepage_category: "",
};

const TEMPLATE_HEADERS = [
  "title", "category", "mode", "short_description", "full_description", "image_url",
  "location", "city", "event_date", "start_time", "end_time", "registration_deadline",
  "is_paid", "price", "total_seats", "external_link", "skills", "recommended_for",
  "featured", "is_government",
];

const EXPORT_HEADERS = [
  "event_id",
  "clann_event_id",
  "title",
  "category",
  "mode",
  "short_description",
  "full_description",
  "image_url",
  "location",
  "city",
  "event_date",
  "start_time",
  "end_time",
  "registration_deadline",
  "is_paid",
  "price",
  "total_seats",
  "seats_left",
  "external_link",
  "skills",
  "recommended_for",
  "featured",
  "is_government",
  "homepage_category",
  "created_at",
];

const truthy = (v) => {
  if (typeof v === "boolean") return v;
  if (v === undefined || v === null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "yes" || s === "y" || s === "1";
};

// Convert xlsx cell value into a "YYYY-MM-DD" string.
// Handles JS Date objects, Excel serial numbers, and ISO/locale date strings.
const toISODate = (v) => {
  if (v === undefined || v === null || v === "") return "";
  if (v instanceof Date && !isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof v === "number" && isFinite(v)) {
    // Excel epoch: days since 1899-12-30 (accounting for 1900 leap bug)
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    }
  }
  const s = String(v).trim();
  // Already YYYY-MM-DD?
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Try Date parse for other formats
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }
  return s;
};

const toTime = (v) => {
  if (v === undefined || v === null || v === "") return "";
  if (v instanceof Date && !isNaN(v.getTime())) {
    const h = String(v.getHours()).padStart(2, "0");
    const m = String(v.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }
  if (typeof v === "number" && isFinite(v) && v < 1) {
    // Excel time-only serial (fraction of a day)
    const total = Math.round(v * 24 * 60);
    const h = String(Math.floor(total / 60)).padStart(2, "0");
    const m = String(total % 60).padStart(2, "0");
    return `${h}:${m}`;
  }
  return String(v).trim();
};

const splitList = (v) => {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (v === undefined || v === null || v === "") return [];
  return String(v).split(/[,|;]/).map((s) => s.trim()).filter(Boolean);
};

const normalizeRow = (row) => {
  const seats = Number(row.total_seats) || 0;
  const eventDate = toISODate(row.event_date);
  return {
    title: String(row.title || "").trim(),
    category: String(row.category || "Workshop").trim(),
    mode: String(row.mode || "Offline").trim(),
    short_description: String(row.short_description || "").trim(),
    full_description: String(row.full_description || row.short_description || "").trim(),
    image_url: String(row.image_url || "").trim(),
    location: String(row.location || "").trim(),
    city: String(row.city || "Delhi").trim(),
    event_date: eventDate,
    start_time: toTime(row.start_time) || "10:00",
    end_time: toTime(row.end_time) || "13:00",
    registration_deadline: toISODate(row.registration_deadline) || eventDate,
    is_paid: truthy(row.is_paid),
    price: row.price ? String(row.price) : null,
    total_seats: seats,
    seats_left: seats,
    external_link: String(row.external_link || "").trim(),
    skills: splitList(row.skills),
    recommended_for: splitList(row.recommended_for),
    featured: truthy(row.featured),
    is_government: truthy(row.is_government),
  };
};

const toExportRow = (ev) => ({
  event_id: ev.event_id || "",
  clann_event_id: ev.clann_event_id || "",
  title: ev.title || "",
  category: ev.category || "",
  mode: ev.mode || "",
  short_description: ev.short_description || "",
  full_description: ev.full_description || "",
  image_url: ev.image_url || "",
  location: ev.location || "",
  city: ev.city || "",
  event_date: ev.event_date || "",
  start_time: ev.start_time || "",
  end_time: ev.end_time || "",
  registration_deadline: ev.registration_deadline || "",
  is_paid: !!ev.is_paid,
  price: ev.price != null ? String(ev.price) : "",
  total_seats: ev.total_seats ?? "",
  seats_left: ev.seats_left ?? "",
  external_link: ev.external_link || "",
  skills: Array.isArray(ev.skills) ? ev.skills.join(" | ") : (ev.skills || ""),
  recommended_for: Array.isArray(ev.recommended_for) ? ev.recommended_for.join(" | ") : (ev.recommended_for || ""),
  featured: !!ev.featured,
  is_government: !!ev.is_government,
  homepage_category: ev.homepage_category || "",
  created_at: ev.created_at || "",
});

// Client-side mirror of backend generate_event_tags — used in the create form
// where the event does not yet exist to call the generate-tags endpoint.
const containsAny = (text, keywords) => {
  if (!text) return false;
  return keywords.some((kw) => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(text);
  });
};

const dedupeTags = (items) => {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (item === undefined || item === null) continue;
    const s = String(item).trim();
    const key = s.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
};

const generateEventTags = (title, category, shortDescription) => {
  const titleText = (title || "").trim();
  const haystack = `${titleText} ${(shortDescription || "").trim()}`.trim();
  const cat = (category || "").trim().toLowerCase();

  let skills = [];
  if (cat === "workshop" || containsAny(haystack, ["design", "figma", "sketch", "illustration", "art"])) {
    skills = skills.concat(["Design Thinking", "Visual Communication", "Creative Skills"]);
  }
  if (containsAny(titleText, ["coding", "python", "javascript", "web", "app", "tech", "ai", "ml"])) {
    skills = skills.concat(["Programming", "Technical Skills", "Problem Solving"]);
  }
  if (containsAny(titleText, ["public speaking", "communication", "presentation"])) {
    skills = skills.concat(["Communication", "Public Speaking", "Confidence"]);
  }
  if (containsAny(titleText, ["business", "startup", "entrepreneurship", "marketing"])) {
    skills = skills.concat(["Business Strategy", "Networking", "Leadership"]);
  }
  if (containsAny(titleText, ["photography", "film", "cinema", "video"])) {
    skills = skills.concat(["Visual Storytelling", "Photography", "Creative Direction"]);
  }
  if (containsAny(titleText, ["music", "dance", "performance", "theatre", "acting"])) {
    skills = skills.concat(["Performance", "Stage Presence", "Creative Expression"]);
  }
  if (cat === "hackathon") skills = skills.concat(["Problem Solving", "Teamwork", "Innovation"]);
  if (cat === "conference") skills = skills.concat(["Industry Knowledge", "Networking", "Professional Development"]);
  if (cat === "meetup") skills = skills.concat(["Networking", "Community Building", "Communication"]);
  if (skills.length === 0) skills = ["Learning", "Networking", "Skill Development"];

  let recs = [];
  if (containsAny(titleText, ["student", "college", "university", "campus"])) recs.push("Students");
  if (containsAny(titleText, ["beginner", "starter", "introduction", "basics", "101"])) recs.push("Beginners");
  if (containsAny(titleText, ["professional", "corporate", "industry", "career"])) recs.push("Professionals");
  if (containsAny(titleText, ["designer", "design"])) recs.push("Designers");
  if (containsAny(titleText, ["developer", "coder", "programmer"])) recs.push("Developers");
  if (containsAny(titleText, ["entrepreneur", "founder", "startup"])) recs.push("Entrepreneurs");
  if (cat === "hackathon") recs = recs.concat(["Students", "Developers", "Innovators"]);
  if (cat === "conference") recs = recs.concat(["Professionals", "Industry Experts"]);
  if (recs.length === 0) recs = ["All", "Curious Minds"];

  return { skills: dedupeTags(skills).slice(0, 5), recommendedFor: dedupeTags(recs).slice(0, 5) };
};

const AdminPanel = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total_events: 0, total_users: 0, total_organizers: 0 });
  const [events, setEvents] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [subFilter, setSubFilter] = useState("pending");
  const [subAction, setSubAction] = useState(null); // submission_id currently being approved/rejected
  const [expandedSubmission, setExpandedSubmission] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [tab, setTab] = useState("events");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyEvent);
  const [skillsInput, setSkillsInput] = useState("");
  const [imageWarning, setImageWarning] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatingTags, setGeneratingTags] = useState(false);
  const [uploadStats, setUploadStats] = useState(null); // {ok, duplicate_count, failed, total}
  const [exporting, setExporting] = useState(null); // 'excel' | 'csv' | null
  const [deletingAll, setDeletingAll] = useState(false);
  const [homepageCategories, setHomepageCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState(false);
  const [displayType, setDisplayType] = useState("standard");
  const [existingCategory, setExistingCategory] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [manualCategory, setManualCategory] = useState("");
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const fileInputRef = useRef(null);
  const imageCheckRef = useRef(0);

  const checkImageOrientation = (value) => {
    const requestId = ++imageCheckRef.current;
    const url = String(value || "").trim();
    setImageWarning(false);
    if (!url) return;

    const image = new Image();
    image.onload = () => {
      if (requestId !== imageCheckRef.current) return;
      setImageWarning(image.naturalHeight >= image.naturalWidth);
    };
    image.onerror = () => {
      if (requestId === imageCheckRef.current) setImageWarning(false);
    };
    image.src = url;
  };

  const isAuthed = () => !!localStorage.getItem("clann_admin_token");

  useEffect(() => {
    if (!isAuthed()) { navigate("/admin-clann-secret"); return; }
    loadData();
  }, [navigate]);

  const loadData = async () => {
    try {
      const [s, e, f, subs] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/events"),
        api.get("/admin/feedback").catch(() => ({ data: [] })),
        api.get("/admin/submissions").catch(() => ({ data: [] })),
      ]);
      setStats(s.data); setEvents(e.data); setFeedback(f.data || []); setSubmissions(subs.data || []);
    } catch (err) {
      if (err.response?.status === 401) { localStorage.removeItem("clann_admin_token"); navigate("/admin-clann-secret"); }
    }
    setCatLoading(true);
    setCatError(false);
    try {
      const cRes = await api.get("/homepage-categories");
      setHomepageCategories(cRes.data || []);
    } catch (err) {
      setCatError(true);
    } finally {
      setCatLoading(false);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setImageWarning(false);
    imageCheckRef.current += 1;
    setForm(emptyEvent);
    setSkillsInput("");
    setDisplayType("standard");
    setExistingCategory("");
    setNewCategoryName("");
    setManualCategory("");
    setOpen(true);
  };
  const openEdit = (ev) => {
    setEditingId(ev.event_id);
    setImageWarning(false);
    imageCheckRef.current += 1;
    setForm({ ...emptyEvent, ...ev, price: ev.price || "" });
    setSkillsInput((ev.skills || []).join(", "));
    const cat = (ev.homepage_category || "").trim();
    if (!cat) {
      setDisplayType("standard");
      setExistingCategory("");
      setNewCategoryName("");
      setManualCategory("");
    } else if (catError) {
      setDisplayType("existing");
      setExistingCategory(cat);
      setNewCategoryName("");
      setManualCategory(cat);
    } else if (homepageCategories.includes(cat)) {
      setDisplayType("existing");
      setExistingCategory(cat);
      setNewCategoryName("");
      setManualCategory(cat);
    } else {
      setDisplayType("new");
      setNewCategoryName(cat);
      setExistingCategory("");
      setManualCategory(cat);
    }
    setOpen(true);
  };

  const save = async () => {
    // image_url is OPTIONAL — events without a real image show the flat
    // category placeholder. Never require (or auto-fill) an image.
    if (!form.title || !form.external_link || !form.event_date) {
      toast.error("Please fill required fields"); return;
    }
    let hpCategory = "";
    if (displayType === "existing") {
      hpCategory = (catError ? manualCategory : existingCategory).trim();
      if (!hpCategory) {
        toast.error("Please select or enter an existing category");
        return;
      }
    } else if (displayType === "new") {
      hpCategory = newCategoryName.trim();
      if (!hpCategory) {
        toast.error("Please enter a new category name");
        return;
      }
    }
    const payload = {
      ...form,
      homepage_category: hpCategory,
      skills: skillsInput.split(",").map((s) => s.trim()).filter(Boolean),
    };
    payload.total_seats = Number(payload.total_seats) || 0;
    if (!payload.seats_left) payload.seats_left = payload.total_seats;
    try {
      if (editingId) await api.put(`/events/${editingId}`, payload);
      else await api.post(`/events`, payload);
      toast.success(editingId ? "Event updated" : "Event published");
      setOpen(false); loadData();
    } catch { toast.error("Failed to save"); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this event?")) return;
    try { await api.delete(`/events/${id}`); toast.success("Deleted"); loadData(); }
    catch { toast.error("Delete failed"); }
  };

  const removeAll = async () => {
    if (deletingAll || events.length === 0) return;
    if (!window.confirm(`Delete ALL ${events.length} events? This cannot be undone.`)) return;
    setDeletingAll(true);
    try {
      const { data } = await api.delete("/events");
      toast.success(`Deleted ${data?.deleted ?? "all"} events`);
      loadData();
    } catch { toast.error("Delete all failed"); }
    setDeletingAll(false);
  };

  const startEditCategory = (c) => {
    setEditingCategory(c);
    setEditingCategoryName(c);
  };

  const saveCategoryRename = async (oldName) => {
    const newName = editingCategoryName.trim();
    if (!newName) {
      toast.error("Category name cannot be empty");
      return;
    }
    try {
      await api.patch("/homepage-categories/rename", { old_name: oldName, new_name: newName });
      toast.success("Category renamed successfully");
      setEditingCategory(null);
      setEditingCategoryName("");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to rename category");
    }
  };

  const deleteCategory = async (catName) => {
    if (!window.confirm(`Delete category "${catName}"? All events with this category will be unassigned.`)) return;
    try {
      await api.delete(`/homepage-categories/${encodeURIComponent(catName)}`);
      toast.success("Category deleted");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete category");
    }
  };

  const toggleFeatured = async (ev) => {
    try { await api.put(`/events/${ev.event_id}`, { featured: !ev.featured }); loadData(); }
    catch { toast.error("Update failed"); }
  };

  const logout = () => { localStorage.removeItem("clann_admin_token"); navigate("/admin-clann-secret"); };

  const approveSubmission = async (id) => {
    if (subAction) return;
    setSubAction(id);
    try {
      const { data } = await api.post(`/admin/submissions/${id}/approve`);
      toast.success(`Event published — "${data.event?.title || "new event"}" is live`);
      loadData();
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Approval failed");
    } finally {
      setSubAction(null);
    }
  };

  const rejectSubmission = async (id) => {
    const reason = window.prompt("Reason for rejection (optional, shown to the organizer):", "");
    if (reason === null) return; // cancelled
    if (subAction) return;
    setSubAction(id);
    try {
      await api.post(`/admin/submissions/${id}/reject`, { reason });
      toast.success("Submission rejected");
      loadData();
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Rejection failed");
    } finally {
      setSubAction(null);
    }
  };

  const deleteSubmission = async (id) => {
    if (!window.confirm("Delete this submission permanently?")) return;
    try { await api.delete(`/admin/submissions/${id}`); toast.success("Submission deleted"); loadData(); }
    catch { toast.error("Delete failed"); }
  };

  const saveNote = async (id) => {
    setNoteSaving(true);
    try {
      await api.post(`/admin/submissions/${id}/note`, { reason: noteDraft });
      toast.success("Note saved");
      loadData();
    } catch { toast.error("Could not save note"); }
    setNoteSaving(false);
  };

  const toggleAudience = (a) => setForm((f) => ({ ...f, recommended_for: f.recommended_for.includes(a) ? f.recommended_for.filter((x) => x !== a) : [...f.recommended_for, a] }));

  const handleGenerateTags = async () => {
    setGeneratingTags(true);
    try {
      let skills, recommendedFor;
      if (editingId) {
        // Existing event — regenerate on the server and persist immediately.
        const { data } = await api.post(`/admin/events/${editingId}/generate-tags`);
        skills = data.skills || [];
        recommendedFor = data.recommended_for || [];
      } else {
        // New event — derive locally (no record exists to call the endpoint with).
        const gen = generateEventTags(form.title, form.category, form.short_description);
        skills = gen.skills;
        recommendedFor = gen.recommendedFor;
      }
      setSkillsInput(skills.join(", "));
      setForm((f) => ({ ...f, skills, recommended_for: recommendedFor }));
      toast.success("Tags generated");
    } catch {
      toast.error("Failed to generate tags");
    } finally {
      setGeneratingTags(false);
    }
  };

  const downloadTemplate = () => {
    const sample = [{
      title: "Sample Workshop", category: "Workshop", mode: "Offline",
      short_description: "Learn something amazing in 2 hours.",
      full_description: "Full description shown on the event detail page.",
      // image_url is OPTIONAL. Leave it blank when there is no real event
      // image — the app shows a flat category placeholder. Never paste a stock
      // photo URL here as a stand-in for a real event image.
      image_url: "",
      location: "Indiranagar, Bengaluru", city: "Bangalore",
      event_date: "2026-06-15", start_time: "10:00", end_time: "13:00",
      registration_deadline: "2026-06-10",
      is_paid: false, price: "", total_seats: 40,
      external_link: "https://example.com/register",
      skills: "Design, Prototyping", recommended_for: "Students, Designers",
      featured: false, is_government: false,
    }];
    const ws = XLSX.utils.json_to_sheet(sample, { header: TEMPLATE_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Events");
    XLSX.writeFile(wb, "clann-events-template.xlsx");
    toast.success("Template downloaded");
  };

  const processFile = async (file) => {
    if (!file) return;
    const name = (file.name || "").toLowerCase();
    if (!(name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv"))) {
      toast.error("Please upload a .xlsx, .xls or .csv file"); return;
    }
    setUploading(true);
    setUploadStats(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const first = wb.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[first], { defval: "", raw: true });
      if (rows.length === 0) { toast.error("Sheet is empty"); setUploading(false); return; }

      let ok = 0, duplicate_count = 0, failed = 0;
      for (const raw of rows) {
        const payload = normalizeRow(raw);
        // Required: title, external_link, event_date. image_url is OPTIONAL —
        // blank rows import fine and show the category placeholder.
        if (!payload.title || !payload.external_link || !payload.event_date) {
          failed++; continue;
        }
        try {
          await api.post("/events", payload);
          ok++;
        } catch (err) {
          if (err.response?.status === 409) {
            duplicate_count++;
            continue;
          }
          console.error("[admin] bulk row failed", err, raw);
          failed++;
        }
      }
      setUploadStats({ ok, duplicate_count, failed, total: rows.length });
      if (ok > 0 || duplicate_count > 0) {
        toast.success(`${ok} event${ok !== 1 ? "s" : ""} imported${duplicate_count > 0 ? `, ${duplicate_count} duplicate${duplicate_count !== 1 ? "s" : ""} skipped` : ""}`);
      }
      if (failed > 0) toast.error(`${failed} row${failed > 1 ? "s" : ""} could not be imported`);
      loadData();
    } catch (err) {
      console.error("[admin] bulk upload failed", err);
      toast.error("Could not read that file");
    }
    setUploading(false);
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processFile(file);
  };

  const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const fetchAllEventsForExport = async () => {
    try {
      const { data } = await api.get("/admin/events/export");
      return data || [];
    } catch (err) {
      if (err.response?.status === 401) throw err;
      const { data } = await api.get("/events");
      return data || [];
    }
  };

  const handleExportExcel = async () => {
    if (exporting) return;
    setExporting("excel");
    try {
      const allEvents = await fetchAllEventsForExport();
      if (!allEvents || allEvents.length === 0) {
        toast.error("No events available to export.");
        return;
      }
      const rows = allEvents.map(toExportRow);
      const ws = XLSX.utils.json_to_sheet(rows, { header: EXPORT_HEADERS });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Events");
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `CLANN_All_Events_${dateStr}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(`${allEvents.length} events exported successfully`);
    } catch (err) {
      console.error("[admin] export excel failed", err);
      if (err.response?.status === 401) toast.error("Admin authentication required");
      else toast.error("Failed to export events. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const handleExportCSV = async () => {
    if (exporting) return;
    setExporting("csv");
    try {
      const allEvents = await fetchAllEventsForExport();
      if (!allEvents || allEvents.length === 0) {
        toast.error("No events available to export.");
        return;
      }
      const rows = allEvents.map(toExportRow);
      const ws = XLSX.utils.json_to_sheet(rows, { header: EXPORT_HEADERS });
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `CLANN_All_Events_${dateStr}.csv`;
      triggerDownload(blob, filename);
      toast.success(`${allEvents.length} events exported successfully`);
    } catch (err) {
      console.error("[admin] export csv failed", err);
      if (err.response?.status === 401) toast.error("Admin authentication required");
      else toast.error("Failed to export events. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 bg-canvas border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ThemedLogo className="h-8 w-auto shrink-0" />
            <div>
              <div className="t-label text-ink-2 font-bold uppercase">Admin Console</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Theme switch — immediately left of Logout. Renders nothing while
                ENABLE_LIGHT_MODE is false (see src/lib/theme.js). */}
            <ThemeToggle />
            <button data-testid="admin-logout" onClick={logout} className="t-body text-cta-text hover:underline inline-flex items-center gap-2 transition-colors duration-fast ease-standard">
              <LogOut size={16} strokeWidth={1.75}/> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard testid="stat-events" label="Total Events" value={stats.total_events} Icon={Calendar}/>
          <StatCard testid="stat-users" label="Registered Users" value={stats.total_users} Icon={Users}/>
          <StatCard testid="stat-organizers" label="Organizers" value={stats.total_organizers} Icon={TicketCheck}/>
        </div>

        <div className="mt-8">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4 w-full">
              <TabsTrigger data-testid="admin-tab-events" value="events">Events</TabsTrigger>
              <TabsTrigger data-testid="admin-tab-feedback" value="feedback">
                <MessageSquare size={16} strokeWidth={1.75}/> Feedback ({feedback.length})
              </TabsTrigger>
              <TabsTrigger data-testid="admin-tab-submissions" value="submissions">
                <ClipboardList size={16} strokeWidth={1.75}/> Submissions ({submissions.filter((s) => s.status === "pending").length})
              </TabsTrigger>
              <TabsTrigger data-testid="admin-tab-categories" value="categories">
                Manage Categories ({homepageCategories.length})
              </TabsTrigger>
              <TabsTrigger data-testid="admin-tab-images" value="images">Image Finder</TabsTrigger>
            </TabsList>

            <TabsContent value="events">
              {/* Bulk upload */}
              <div
                data-testid="bulk-drop"
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={cn("mb-6 rounded-lg border-2 border-dashed p-6 transition-colors duration-fast ease-standard", dragOver ? "border-focus bg-raised" : "border-line bg-surface")}
              >
                <div className="flex flex-col md:flex-row items-center md:items-start gap-4">
                  <div className="h-12 w-12 rounded-md bg-raised border border-line flex items-center justify-center text-ink-muted shrink-0">
                    <FileSpreadsheet size={24} strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="t-body-strong text-ink">Bulk import events</h3>
                    <p className="t-caption text-ink-muted mt-1">
                      Drag & drop an <span className="text-ink-2 font-semibold">.xlsx</span> or <span className="text-ink-2 font-semibold">.csv</span> file — every row becomes a new event card. Required columns: title, external_link, event_date. <span className="text-ink-2 font-semibold">image_url is optional</span> — rows without a real event image get an automatic fallback image.
                    </p>
                    {uploadStats && (
                      <p className="mt-2 t-caption" data-testid="bulk-stats">
                        <span className="text-ok font-bold">{uploadStats.ok} imported</span>
                        {uploadStats.duplicate_count > 0 && <span className="text-ink-2 font-bold ml-2">· {uploadStats.duplicate_count} duplicates skipped</span>}
                        {uploadStats.failed > 0 && <span className="text-danger font-bold ml-2">· {uploadStats.failed} failed</span>}
                        <span className="text-ink-muted ml-2">of {uploadStats.total} rows</span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      data-testid="bulk-template-btn"
                      onClick={downloadTemplate}
                      className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                    >
                      <Download size={16} strokeWidth={1.75}/> Template
                    </button>
                    <button
                      data-testid="bulk-choose-btn"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                    >
                      <Upload size={16} strokeWidth={1.75}/> {uploading ? "Importing..." : "Choose file"}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xls,.xlsx"
                      className="hidden"
                      data-testid="bulk-file-input"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }}
                    />
                  </div>
                </div>
              </div>

              {/* Export all events — admin-only, complete database */}
              <div
                data-testid="export-section"
                className="mb-6 rounded-lg border border-line bg-surface p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-md bg-raised border border-line flex items-center justify-center text-ink-muted shrink-0">
                    <Download size={20} strokeWidth={1.75} />
                  </div>
                  <div>
                    <h3 className="t-body-strong text-ink">Export all events</h3>
                    <p className="t-caption text-ink-muted mt-1">Download your complete event database as a single spreadsheet.</p>
                    <p className="t-caption text-ink-muted mt-1">Includes all events in the database — not just the current view.</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0 self-stretch md:self-auto">
                  <button
                    data-testid="export-excel-btn"
                    onClick={handleExportExcel}
                    disabled={!!exporting}
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "flex-1 md:flex-none")}
                  >
                    {exporting === "excel" ? <Loader2 size={16} strokeWidth={1.75} className="animate-spin" /> : <FileSpreadsheet size={16} strokeWidth={1.75} />}
                    {exporting === "excel" ? "Exporting..." : "Export Excel"}
                  </button>
                  <button
                    data-testid="export-csv-btn"
                    onClick={handleExportCSV}
                    disabled={!!exporting}
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "flex-1 md:flex-none")}
                  >
                    {exporting === "csv" ? <Loader2 size={16} strokeWidth={1.75} className="animate-spin" /> : <Download size={16} strokeWidth={1.75} />}
                    {exporting === "csv" ? "Exporting..." : "Export CSV"}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <h2 className="t-h1 text-ink">Events</h2>
                <div className="flex items-center gap-2">
                  <button
                    data-testid="delete-all-events-btn"
                    onClick={removeAll}
                    disabled={deletingAll || events.length === 0}
                    title="Delete all events"
                    className={cn(buttonVariants({ variant: "destructive", size: "sm" }), "disabled:pointer-events-auto disabled:cursor-not-allowed")}
                  >
                    {deletingAll ? <Loader2 size={16} strokeWidth={1.75} className="animate-spin"/> : <Trash2 size={16} strokeWidth={1.75}/>}
                    {deletingAll ? "Deleting..." : "Delete All"}
                  </button>
                  <button data-testid="add-event-btn" onClick={openAdd} className={cn(buttonVariants({ variant: "primary", size: "sm" }))}>
                    <Plus size={16} strokeWidth={1.75}/> Add New Event
                  </button>
                </div>
              </div>

              <div className="bg-surface border border-line rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full t-body" data-testid="events-table">
                    <thead className="bg-raised text-ink-muted t-label uppercase">
                      <tr>
                        <th className="text-left px-4 py-3">Title</th>
                        <th className="text-left px-4 py-3">Category</th>
                        <th className="text-left px-4 py-3">Date</th>
                        <th className="text-left px-4 py-3">Featured</th>
                        <th className="text-left px-4 py-3">Seats</th>
                        <th className="text-right px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {events.map((ev) => (
                        <tr key={ev.event_id} className="hover:bg-raised transition-colors duration-fast ease-standard" data-testid={`row-${ev.event_id}`}>
                          <td className="px-4 py-3 t-body-strong text-ink">{ev.title}</td>
                          <td className="px-4 py-3 t-body text-ink-2">{ev.category}</td>
                          <td className="px-4 py-3 t-body text-ink-2">{ev.event_date}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => toggleFeatured(ev)} className={cn("inline-flex h-6 items-center gap-1 rounded-full border px-2 t-caption font-bold uppercase transition-colors duration-fast ease-standard", ev.featured ? "border-selected bg-selected text-on-selected" : "border-line bg-chip text-ink")}>
                              <Star size={16} strokeWidth={1.75} fill={ev.featured ? "currentColor" : "none"}/>
                              {ev.featured ? "Yes" : "No"}
                            </button>
                          </td>
                          <td className="px-4 py-3 t-body text-ink-2">{ev.seats_left}/{ev.total_seats}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => openEdit(ev)} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-raised hover:text-ink transition-colors duration-fast ease-standard mr-1" data-testid={`edit-${ev.event_id}`}><Edit2 size={16} strokeWidth={1.75}/></button>
                            <button onClick={() => remove(ev.event_id)} className="flex h-8 w-8 items-center justify-center rounded-full text-danger hover:bg-danger-bg transition-colors duration-fast ease-standard" data-testid={`delete-${ev.event_id}`}><Trash2 size={16} strokeWidth={1.75}/></button>
                          </td>
                        </tr>
                      ))}
                      {events.length === 0 && (
                        <tr><td colSpan="6" className="text-center py-12 t-caption text-ink-muted">No events yet. Add your first event.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="feedback">
              <h2 className="t-h1 text-ink mb-4">User Feedback</h2>
              <div className="bg-surface border border-line rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full t-body" data-testid="feedback-table">
                    <thead className="bg-raised text-ink-muted t-label uppercase">
                      <tr>
                        <th className="text-left px-4 py-3">User</th>
                        <th className="text-left px-4 py-3">Rating</th>
                        <th className="text-left px-4 py-3">Feedback</th>
                        <th className="text-left px-4 py-3">Submitted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {feedback.map((f) => (
                        <tr key={f.feedback_id} data-testid={`feedback-row-${f.feedback_id}`} className="hover:bg-raised transition-colors duration-fast ease-standard">
                          <td className="px-4 py-3 t-body-strong text-ink align-top whitespace-nowrap">
                            {f.user_name || f.user_email}
                            <div className="t-caption text-ink-muted font-normal">{f.user_email}</div>
                          </td>
                          <td className="px-4 py-3 align-top whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-cta-text">
                              {[...Array(5)].map((_, i) => (
                                <Star key={`fb-${f.feedback_id}-star-${i}`} size={16} strokeWidth={1.75} fill={i < f.star_rating ? "currentColor" : "none"} className={i < f.star_rating ? "" : "text-line-input"}/>
                              ))}
                              <span className="ml-1 t-caption text-ink">{f.star_rating}/5</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 t-body text-ink max-w-md align-top">{f.feedback_text || <span className="text-ink-muted italic">—</span>}</td>
                          <td className="px-4 py-3 t-caption text-ink-muted whitespace-nowrap align-top">
                            {f.submitted_at ? new Date(f.submitted_at).toLocaleString() : "—"}
                          </td>
                        </tr>
                      ))}
                      {feedback.length === 0 && (
                        <tr><td colSpan="4" className="text-center py-12 t-caption text-ink-muted">No feedback submitted yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="submissions">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h2 className="t-h1 text-ink">Organizer Submissions</h2>
                <div className="inline-flex bg-raised border border-line rounded-full p-1 w-fit" data-testid="submission-filters">
                  {["pending", "approved", "rejected"].map((f) => (
                    <button
                      key={f}
                      data-testid={`sub-filter-${f}`}
                      onClick={() => setSubFilter(f)}
                      className={cn("inline-flex min-h-9 items-center rounded-full px-4 t-label font-bold uppercase transition-colors duration-fast ease-standard",
                        subFilter === f ? "bg-selected text-on-selected" : "text-ink-2 hover:bg-raised hover:text-ink"
                      )}
                    >
                      {f} ({submissions.filter((s) => s.status === f).length})
                    </button>
                  ))}
                </div>
              </div>

              {submissions.length === 0 ? (
                <div className="bg-surface border border-line rounded-lg p-12 text-center">
                  <ClipboardList size={24} strokeWidth={1.75} className="mx-auto text-line-input mb-2" />
                  <p className="t-body text-ink-muted">No submissions yet. Organizers can propose events via the public "List Your Event" page.</p>
                </div>
              ) : (
                <div className="bg-surface border border-line rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full t-body" data-testid="submissions-table">
                      <thead className="bg-raised text-ink-muted t-label uppercase">
                        <tr>
                          <th className="text-left px-4 py-3">Organizer</th>
                          <th className="text-left px-4 py-3">Event</th>
                          <th className="text-left px-4 py-3">Date</th>
                          <th className="text-left px-4 py-3">Status</th>
                          <th className="text-left px-4 py-3">Submitted</th>
                          <th className="text-right px-4 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {submissions
                          .filter((s) => s.status === subFilter)
                          .map((s) => (
                            <tr key={s.submission_id} data-testid={`submission-row-${s.submission_id}`} onClick={() => { setExpandedSubmission(s); setNoteDraft(s.admin_note || ""); }} className="hover:bg-raised transition-colors duration-fast ease-standard align-top cursor-pointer">
                              <td className="px-4 py-3 t-body-strong text-ink whitespace-nowrap">
                                {s.organizer_name}
                                <div className="t-caption text-ink-muted font-normal break-all">{s.organizer_email}</div>
                                {s.organizer_phone && <div className="t-caption text-ink-muted font-normal">{s.organizer_phone}</div>}
                              </td>
                              <td className="px-4 py-3 max-w-xs">
                                <div className="t-body-strong text-ink">{s.title}</div>
                                <div className="t-label text-ink-2 uppercase font-bold mt-1">{s.category} · {s.mode}</div>
                                {s.short_description && <div className="t-caption text-ink-muted mt-1 line-clamp-2">{s.short_description}</div>}
                                {s.created_event_id && (
                                  <Link
                                    to={`/event/${s.created_event_id}`}
                                    className="inline-block mt-2 t-caption font-bold text-ok hover:underline transition-colors duration-fast ease-standard"
                                  >
                                    View live event →
                                  </Link>
                                )}
                                {s.status === "rejected" && s.reject_reason && (
                                  <div className="t-caption text-danger mt-1">Reason: {s.reject_reason}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 t-body text-ink-2 whitespace-nowrap">
                                {s.event_date}
                                <div className="t-caption text-ink-muted">{s.start_time} – {s.end_time}</div>
                                {s.city && <div className="t-caption text-ink-muted">{s.city}</div>}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={cn("inline-flex h-6 items-center gap-1 rounded-full border px-2 t-caption font-bold uppercase",
                                  s.status === "pending" ? "bg-raised text-ink border-line-input"
                                  : s.status === "approved" ? "bg-ok-bg text-ok border-ok"
                                  : "bg-danger-bg text-danger border-danger"
                                )}>
                                  {s.status === "pending" ? <Clock size={16} strokeWidth={1.75} aria-hidden="true"/>
                                    : s.status === "approved" ? <Check size={16} strokeWidth={1.75} aria-hidden="true"/>
                                    : <X size={16} strokeWidth={1.75} aria-hidden="true"/>}
                                  {s.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 t-caption text-ink-muted whitespace-nowrap">
                                {s.submitted_at ? new Date(s.submitted_at).toLocaleString() : "—"}
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                {s.status === "pending" && (
                                  <>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); approveSubmission(s.submission_id); }}
                                      disabled={!!subAction}
                                      data-testid={`approve-${s.submission_id}`}
                                      className={cn(buttonVariants({ variant: "primary", size: "sm" }), "h-8 px-3 t-caption font-bold mr-2")}
                                    >
                                      {subAction === s.submission_id ? <Loader2 size={16} strokeWidth={1.75} className="animate-spin"/> : <Check size={16} strokeWidth={1.75}/>}
                                      Approve and publish
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); rejectSubmission(s.submission_id); }}
                                      disabled={!!subAction}
                                      data-testid={`reject-${s.submission_id}`}
                                      className={cn(buttonVariants({ variant: "destructive", size: "sm" }), "h-8 px-3 t-caption font-bold mr-2")}
                                    >
                                      <X size={16} strokeWidth={1.75}/> Reject with reason
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteSubmission(s.submission_id); }}
                                  data-testid={`delete-submission-${s.submission_id}`}
                                  title="Delete submission"
                                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-danger-bg hover:text-danger transition-colors duration-fast ease-standard"
                                >
                                  <Trash2 size={16} strokeWidth={1.75}/>
                                </button>
                              </td>
                            </tr>
                          ))}
                        {submissions.filter((s) => s.status === subFilter).length === 0 && (
                          <tr><td colSpan="6" className="text-center py-12 t-caption text-ink-muted">No {subFilter} submissions.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="categories">
              <div className="flex items-center justify-between mb-4">
                <h2 className="t-h1 text-ink">Manage Homepage Categories</h2>
              </div>
              <div className="bg-surface border border-line rounded-lg overflow-hidden p-6">
                {catLoading ? (
                  <p className="t-body text-ink-2">Loading categories...</p>
                ) : homepageCategories.length === 0 ? (
                  <p className="t-body text-ink-muted">No homepage categories found.</p>
                ) : (
                  <div className="space-y-3" data-testid="categories-list">
                    {homepageCategories.map((c) => (
                      <div
                        key={c}
                        data-testid={`category-item-${c}`}
                        className="flex items-center justify-between bg-raised border border-line rounded-lg p-3"
                      >
                        {editingCategory === c ? (
                          <div className="flex items-center gap-2 flex-1 mr-4">
                            <Input
                              type="text"
                              data-testid={`category-input-${c}`}
                              value={editingCategoryName}
                              onChange={(e) => setEditingCategoryName(e.target.value)}
                              className="h-9 max-w-sm"
                            />
                            <button
                              type="button"
                              data-testid={`category-save-${c}`}
                              onClick={() => saveCategoryRename(c)}
                              className={cn(buttonVariants({ variant: "primary", size: "sm" }), "h-8 px-3 t-caption font-bold")}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCategory(null)}
                              className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "h-8 px-3 t-caption font-bold")}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span className="t-body-strong text-ink">{c}</span>
                        )}

                        <div className="flex items-center gap-2">
                          {editingCategory !== c && (
                            <button
                              type="button"
                              data-testid={`category-edit-${c}`}
                              onClick={() => startEditCategory(c)}
                              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-raised hover:text-ink transition-colors duration-fast ease-standard"
                              title="Edit Category"
                            >
                              <Edit2 size={16} strokeWidth={1.75} />
                            </button>
                          )}
                          <button
                            type="button"
                            data-testid={`category-delete-${c}`}
                            onClick={() => deleteCategory(c)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-danger hover:bg-danger-bg transition-colors duration-fast ease-standard"
                            title="Delete Category"
                          >
                            <Trash2 size={16} strokeWidth={1.75} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="images">
              <ImageFinder />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Event" : "Add New Event"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label="Event Title" required><Input data-testid="form-title" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})}/></FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Category">
                <Select value={form.category} onValueChange={(v) => setForm({...form, category: v})}>
                  <SelectTrigger data-testid="form-category"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Mode">
                <Select value={form.mode} onValueChange={(v) => setForm({...form, mode: v})}>
                  <SelectTrigger data-testid="form-mode"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <FormField label="Short Description (150 chars, shown on card)">
              <Input data-testid="form-short" maxLength={150} value={form.short_description} onChange={(e) => setForm({...form, short_description: e.target.value})}/>
            </FormField>
            <FormField label="Full Description">
              <Textarea data-testid="form-full" rows={4} value={form.full_description} onChange={(e) => setForm({...form, full_description: e.target.value})} className="resize-y"/>
            </FormField>
            <FormField label="Event Image URL (optional — leave blank for automatic fallback)">
              <Input
                data-testid="form-image"
                value={form.image_url}
                onChange={(e) => setForm({...form, image_url: e.target.value})}
                onBlur={(e) => checkImageOrientation(e.target.value)}
               
              />
              {imageWarning && (
                <p className="mt-1 t-caption text-ink-muted">This image looks square/portrait — event cards are horizontal, so it may get cropped tightly. A landscape (wide) image works best.</p>
              )}
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Location"><Input data-testid="form-location" value={form.location} onChange={(e) => setForm({...form, location: e.target.value})}/></FormField>
              <FormField label="City">
                <Select value={form.city} onValueChange={(v) => setForm({...form, city: v})}>
                  <SelectTrigger data-testid="form-city"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <FormField label="Event Date" required><Input data-testid="form-date" type="date" value={form.event_date} onChange={(e) => setForm({...form, event_date: e.target.value})}/></FormField>
              <FormField label="Start Time"><Input data-testid="form-start" type="time" value={form.start_time} onChange={(e) => setForm({...form, start_time: e.target.value})}/></FormField>
              <FormField label="End Time"><Input data-testid="form-end" type="time" value={form.end_time} onChange={(e) => setForm({...form, end_time: e.target.value})}/></FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Registration Deadline"><Input data-testid="form-deadline" type="date" value={form.registration_deadline} onChange={(e) => setForm({...form, registration_deadline: e.target.value})}/></FormField>
              <FormField label="Total Seats"><Input data-testid="form-seats" type="number" value={form.total_seats} onChange={(e) => setForm({...form, total_seats: e.target.value})}/></FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between gap-4 bg-canvas rounded-lg px-4 py-3 border border-line">
                <label className="t-label text-ink-2">Paid Event</label>
                <Switch data-testid="form-paid" checked={form.is_paid} onCheckedChange={(v) => setForm({...form, is_paid: v})}/>
              </div>
              {form.is_paid && (
                <FormField label="Price"><Input data-testid="form-price" value={form.price} onChange={(e) => setForm({...form, price: e.target.value})} placeholder="₹299"/></FormField>
              )}
            </div>
            <FormField label="External Registration Link" required><Input data-testid="form-link" value={form.external_link} onChange={(e) => setForm({...form, external_link: e.target.value})} placeholder="https://..."/></FormField>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="t-label text-ink-2">Skills You Will Learn (comma separated)</label>
                <button
                  type="button"
                  data-testid="generate-tags-btn"
                  onClick={handleGenerateTags}
                  disabled={generatingTags}
                  className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "h-8 px-3 t-caption font-bold")}
                >
                  {generatingTags ? <Loader2 size={16} strokeWidth={1.75} className="animate-spin"/> : <Wand2 size={16} strokeWidth={1.75}/>}
                  Auto Generate
                </button>
              </div>
              <Input data-testid="form-skills" value={skillsInput} onChange={(e) => setSkillsInput(e.target.value)} placeholder="Graphic Design, Color Theory"/>
            </div>
            <div>
              <label className="t-label text-ink-2">Recommended For</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {AUDIENCE.map((a) => (
                  <button key={a} data-testid={`aud-${a.toLowerCase()}`} onClick={() => toggleAudience(a)} className={cn("inline-flex min-h-9 items-center rounded-full border px-3 t-caption font-bold uppercase tracking-wider transition-colors duration-fast ease-standard", form.recommended_for.includes(a) ? "border-selected bg-selected text-on-selected" : "border-line bg-raised text-ink-2 hover:border-line-input hover:text-ink")}>{a}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 bg-canvas rounded-lg px-4 py-3 border border-line">
              <div>
                <label className="t-label text-ink-2 block">Feature Event</label>
                <span className="t-caption text-ink-muted">Show in hero banner carousel</span>
              </div>
              <Switch data-testid="form-featured" checked={form.featured} onCheckedChange={(v) => setForm({...form, featured: v})}/>
            </div>

            <div className="bg-canvas rounded-lg p-4 border border-line space-y-3">
              <div>
                <label className="t-label text-ink-2 block">Homepage Display</label>
                <span className="t-caption text-ink-muted">Choose how this event is displayed on the homepage</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="display-standard"
                  onClick={() => setDisplayType("standard")}
                  className={cn("inline-flex min-h-9 items-center rounded-full border px-3 t-label font-bold transition-colors duration-fast ease-standard",
                    displayType === "standard"
                      ? "border-selected bg-selected text-on-selected"
                      : "border-line bg-raised text-ink-2 hover:border-line-input hover:text-ink"
                  )}
                >
                  Standard Card
                </button>
                <button
                  type="button"
                  data-testid="display-existing"
                  onClick={() => setDisplayType("existing")}
                  className={cn("inline-flex min-h-9 items-center rounded-full border px-3 t-label font-bold transition-colors duration-fast ease-standard",
                    displayType === "existing"
                      ? "border-selected bg-selected text-on-selected"
                      : "border-line bg-raised text-ink-2 hover:border-line-input hover:text-ink"
                  )}
                >
                  Add to Existing Category Section
                </button>
                <button
                  type="button"
                  data-testid="display-new"
                  onClick={() => setDisplayType("new")}
                  className={cn("inline-flex min-h-9 items-center rounded-full border px-3 t-label font-bold transition-colors duration-fast ease-standard",
                    displayType === "new"
                      ? "border-selected bg-selected text-on-selected"
                      : "border-line bg-raised text-ink-2 hover:border-line-input hover:text-ink"
                  )}
                >
                  Create New Category Section
                </button>
              </div>

              {displayType === "existing" && (
                <div className="pt-2">
                  {catLoading ? (
                    <p className="t-caption text-ink-2">Loading categories…</p>
                  ) : catError ? (
                    <div className="space-y-1">
                      <p className="t-caption text-danger">Failed to load categories. Enter category manually:</p>
                      <Input
                        type="text"
                        data-testid="manual-category-input"
                        placeholder="e.g. Art Walks"
                        value={manualCategory}
                        onChange={(e) => setManualCategory(e.target.value)}
                        
                      />
                    </div>
                  ) : homepageCategories.length === 0 ? (
                    <p className="t-caption text-ink-muted">No existing categories found. Switch to "Create New Category Section" to add one.</p>
                  ) : (
                    <select
                      data-testid="existing-category-select"
                      value={existingCategory}
                      onChange={(e) => setExistingCategory(e.target.value)}
                      className={cn(fieldBaseClassNames, "h-11 px-4")}
                    >
                      <option value="">Select an existing category...</option>
                      {homepageCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {displayType === "new" && (
                <div className="pt-2 space-y-1">
                  <Input
                    type="text"
                    data-testid="new-category-input"
                    placeholder="Art Walks, Photography Events, College Fests"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    
                  />
                  <p className="t-caption text-ink-muted">
                    This will create a new horizontal section on the homepage with this name. You can add more events to it later.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 bg-canvas rounded-lg px-4 py-3 border border-line">
              <div>
                <label className="t-label text-ink-2 block">Government Event</label>
                <span className="t-caption text-ink-muted">Also list under the Government Events section</span>
              </div>
              <Switch data-testid="form-government" checked={!!form.is_government} onCheckedChange={(v) => setForm({...form, is_government: v})}/>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setOpen(false)} className={cn(buttonVariants({ variant: "secondary", size: "md" }), "flex-1")} data-testid="form-cancel">Cancel</button>
              <button onClick={save} data-testid="form-publish" className={cn(buttonVariants({ variant: "primary", size: "md" }), "flex-1")}>
                {editingId ? "Save Changes" : "Publish Event"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>

      {expandedSubmission && (
        <div className="fixed inset-0 z-40 bg-scrim/60 flex items-center justify-center p-4" onClick={() => setExpandedSubmission(null)}>
          <div
            className="relative z-50 bg-surface border border-line rounded-lg p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-elev-2"
            onClick={(e) => e.stopPropagation()}
            data-testid="submission-detail-modal"
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <h2 className="t-h2 text-ink">{expandedSubmission.title}</h2>
              <button onClick={() => setExpandedSubmission(null)} className="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted hover:bg-raised hover:text-ink transition-colors duration-fast ease-standard" aria-label="Close">
                <X size={20} strokeWidth={1.75} />
              </button>
            </div>
            <div className="space-y-3">
              <DetailRow label="Organizer" value={`${expandedSubmission.organizer_name} · ${expandedSubmission.organizer_email}${expandedSubmission.organizer_phone ? " · " + expandedSubmission.organizer_phone : ""}`} />
              <DetailRow label="Category / Mode" value={`${expandedSubmission.category} · ${expandedSubmission.mode}`} />
              <DetailRow label="Short Description" value={expandedSubmission.short_description} />
              <DetailRow label="Full Description" value={expandedSubmission.full_description || "—"} />
              {expandedSubmission.image_url && (
                <div>
                  <div className="t-label uppercase text-ink-2 font-bold mb-1">Image</div>
                  <img src={expandedSubmission.image_url} alt="" className="w-full max-h-48 object-cover rounded-md border border-line" />
                </div>
              )}
              <DetailRow label="Location" value={`${expandedSubmission.location || "—"}, ${expandedSubmission.city || "—"}`} />
              <DetailRow label="Date / Time" value={`${expandedSubmission.event_date} · ${expandedSubmission.start_time}–${expandedSubmission.end_time}`} />
              <DetailRow label="Registration Deadline" value={expandedSubmission.registration_deadline || "—"} />
              <DetailRow label="Paid" value={expandedSubmission.is_paid ? (expandedSubmission.price || "Yes") : "Free"} />
              <DetailRow label="Total Seats" value={String(expandedSubmission.total_seats ?? "—")} />
              <DetailRow label="Registration Link" value={expandedSubmission.external_link || "—"} />
              <DetailRow label="Notes from organizer" value={expandedSubmission.notes || "—"} />
            </div>
            <div className="mt-4 pt-4 border-t border-line">
              <FormField label="Feedback / suggestion for organizer">
                <Textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  rows={3}
                  placeholder="e.g. Please add a clearer event image before we can approve this."
                  className="resize-y"
                />
              </FormField>
              <button
                onClick={() => saveNote(expandedSubmission.submission_id)}
                disabled={noteSaving}
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-2")}
              >
                {noteSaving ? "Saving…" : "Save note for organizer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const StatCard = ({ testid, label, value, Icon }) => (
  <div data-testid={testid} className="bg-surface border border-line rounded-lg p-4 flex items-center gap-4">
    <div className="h-12 w-12 rounded-md bg-raised flex items-center justify-center text-ink-muted">
      <Icon size={24} strokeWidth={1.75}/>
    </div>
    <div>
      <div className="t-h1 text-ink">{value}</div>
      <div className="t-label uppercase text-ink-2 font-bold">{label}</div>
    </div>
  </div>
);

const DetailRow = ({ label, value }) => (
  <div>
    <div className="t-label uppercase text-ink-2 font-bold mb-1">{label}</div>
    <div className="t-body text-ink whitespace-pre-wrap">{value}</div>
  </div>
);

export default AdminPanel;
