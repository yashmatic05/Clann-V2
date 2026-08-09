import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Star, LogOut, Calendar, Users, TicketCheck, MessageSquare, Upload, FileSpreadsheet, Download, Wand2, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as XLSX from "xlsx";

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
  const [tab, setTab] = useState("events");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyEvent);
  const [skillsInput, setSkillsInput] = useState("");
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

  const isAuthed = () => !!localStorage.getItem("clann_admin_token");

  useEffect(() => {
    if (!isAuthed()) { navigate("/admin-clann-secret"); return; }
    loadData();
  }, [navigate]);

  const loadData = async () => {
    try {
      const [s, e, f] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/events"),
        api.get("/admin/feedback").catch(() => ({ data: [] })),
      ]);
      setStats(s.data); setEvents(e.data); setFeedback(f.data || []);
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
    if (!form.title || !form.image_url || !form.external_link || !form.event_date) {
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
      image_url: "https://images.unsplash.com/photo-1523240795612-9a054b0db644",
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
        if (!payload.title || !payload.image_url || !payload.external_link || !payload.event_date) {
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
    <div className="min-h-screen bg-[#0D0D0D]">
      <header className="sticky top-0 z-30 bg-[#0D0D0D]/80 backdrop-blur-xl border-b border-[#280049]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/brand/clann-logo.png" alt="Clann" className="h-8 w-auto" />
            <div>
              <div className="font-black text-lg text-white leading-none">Clann</div>
              <div className="text-[10px] text-[#BF72FF] font-bold uppercase tracking-widest">Admin Console</div>
            </div>
          </div>
          <button data-testid="admin-logout" onClick={logout} className="text-sm text-[#BF72FF] hover:text-white inline-flex items-center gap-1.5 transition-colors">
            <LogOut size={14}/> Logout
          </button>
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
            <TabsList className="bg-[#18002C] border border-[#46176D]/40 rounded-full p-1 mb-4">
              <TabsTrigger data-testid="admin-tab-events" value="events" className="rounded-full data-[state=active]:bg-[#F84E00] data-[state=active]:text-white text-[#BF72FF] font-bold text-xs uppercase tracking-widest px-4">Events</TabsTrigger>
              <TabsTrigger data-testid="admin-tab-feedback" value="feedback" className="rounded-full data-[state=active]:bg-[#F84E00] data-[state=active]:text-white text-[#BF72FF] font-bold text-xs uppercase tracking-widest px-4">
                <MessageSquare size={12} className="mr-1.5"/> Feedback ({feedback.length})
              </TabsTrigger>
              <TabsTrigger data-testid="admin-tab-categories" value="categories" className="rounded-full data-[state=active]:bg-[#F84E00] data-[state=active]:text-white text-[#BF72FF] font-bold text-xs uppercase tracking-widest px-4">
                Manage Categories ({homepageCategories.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="events">
              {/* Bulk upload */}
              <div
                data-testid="bulk-drop"
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`mb-6 rounded-2xl border-2 border-dashed p-6 transition-colors ${dragOver ? "border-[#F84E00] bg-[#F84E00]/5" : "border-[#46176D]/50 bg-[#18002C]"}`}
              >
                <div className="flex flex-col md:flex-row items-center md:items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#280049] border border-[#46176D]/60 flex items-center justify-center text-[#BF72FF] shrink-0">
                    <FileSpreadsheet size={22} />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-white font-bold">Bulk import events</h3>
                    <p className="text-xs text-[#727272] mt-0.5">
                      Drag & drop an <span className="text-[#BF72FF] font-semibold">.xlsx</span> or <span className="text-[#BF72FF] font-semibold">.csv</span> file — every row becomes a new event card.
                    </p>
                    {uploadStats && (
                      <p className="mt-2 text-[11px]" data-testid="bulk-stats">
                        <span className="text-emerald-400 font-bold">{uploadStats.ok} imported</span>
                        {uploadStats.duplicate_count > 0 && <span className="text-amber-400 font-bold ml-2">· {uploadStats.duplicate_count} duplicates skipped</span>}
                        {uploadStats.failed > 0 && <span className="text-red-400 font-bold ml-2">· {uploadStats.failed} failed</span>}
                        <span className="text-[#727272] ml-2">of {uploadStats.total} rows</span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      data-testid="bulk-template-btn"
                      onClick={downloadTemplate}
                      className="inline-flex items-center gap-1.5 border border-[#46176D] text-[#BF72FF] hover:bg-[#280049] hover:text-white rounded-full px-4 py-2 text-xs font-bold transition-colors"
                    >
                      <Download size={13}/> Template
                    </button>
                    <button
                      data-testid="bulk-choose-btn"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="inline-flex items-center gap-1.5 bg-[#F84E00] hover:bg-[#D14200] disabled:opacity-60 text-white rounded-full px-4 py-2 text-xs font-bold transition-colors"
                    >
                      <Upload size={13}/> {uploading ? "Importing..." : "Choose file"}
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
                className="mb-6 rounded-2xl border border-[#46176D]/40 bg-[#18002C] p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#280049] border border-[#46176D]/60 flex items-center justify-center text-[#BF72FF] shrink-0">
                    <Download size={18} />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-sm">Export all events</h3>
                    <p className="text-xs text-[#727272] mt-1">Download your complete event database as a single spreadsheet.</p>
                    <p className="text-[10px] text-[#727272] mt-1">Includes all events in the database — not just the current view.</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0 self-stretch md:self-auto">
                  <button
                    data-testid="export-excel-btn"
                    onClick={handleExportExcel}
                    disabled={!!exporting}
                    className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 bg-white hover:bg-[#FFFBE9] disabled:opacity-60 text-[#0D0D0D] rounded-full px-5 py-2.5 text-xs font-bold transition-colors"
                  >
                    {exporting === "excel" ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                    {exporting === "excel" ? "Exporting..." : "Export Excel"}
                  </button>
                  <button
                    data-testid="export-csv-btn"
                    onClick={handleExportCSV}
                    disabled={!!exporting}
                    className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 border border-[#46176D] text-[#BF72FF] hover:bg-[#280049] hover:text-white disabled:opacity-60 rounded-full px-5 py-2.5 text-xs font-bold transition-colors"
                  >
                    {exporting === "csv" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    {exporting === "csv" ? "Exporting..." : "Export CSV"}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-black text-white tracking-tight">Events</h2>
                <div className="flex items-center gap-2">
                  <button
                    data-testid="delete-all-events-btn"
                    onClick={removeAll}
                    disabled={deletingAll || events.length === 0}
                    title="Delete all events"
                    className="border border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-full px-5 py-2.5 text-sm font-bold inline-flex items-center gap-1.5 transition-colors"
                  >
                    {deletingAll ? <Loader2 size={14} className="animate-spin"/> : <Trash2 size={14}/>}
                    {deletingAll ? "Deleting..." : "Delete All"}
                  </button>
                  <button data-testid="add-event-btn" onClick={openAdd} className="bg-[#F84E00] hover:bg-[#D14200] text-white rounded-full px-5 py-2.5 text-sm font-bold inline-flex items-center gap-1.5 transition-colors">
                    <Plus size={14}/> Add New Event
                  </button>
                </div>
              </div>

              <div className="bg-[#18002C] border border-[#46176D]/30 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="events-table">
                    <thead className="bg-[#280049] text-[#BF72FF] uppercase tracking-widest text-[10px]">
                      <tr>
                        <th className="text-left px-4 py-3">Title</th>
                        <th className="text-left px-4 py-3">Category</th>
                        <th className="text-left px-4 py-3">Date</th>
                        <th className="text-left px-4 py-3">Featured</th>
                        <th className="text-left px-4 py-3">Seats</th>
                        <th className="text-right px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#46176D]/30">
                      {events.map((ev) => (
                        <tr key={ev.event_id} className="hover:bg-[#280049]/40 transition-colors" data-testid={`row-${ev.event_id}`}>
                          <td className="px-4 py-3 text-white font-medium">{ev.title}</td>
                          <td className="px-4 py-3 text-[#BF72FF]">{ev.category}</td>
                          <td className="px-4 py-3 text-white/80">{ev.event_date}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => toggleFeatured(ev)} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${ev.featured ? "bg-[#F84E00] text-white" : "bg-[#280049] text-[#BF72FF]"}`}>
                              <Star size={10} fill={ev.featured ? "currentColor" : "none"}/>
                              {ev.featured ? "Yes" : "No"}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-white/80">{ev.seats_left}/{ev.total_seats}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => openEdit(ev)} className="text-[#BF72FF] hover:text-white p-1.5 mr-1 transition-colors" data-testid={`edit-${ev.event_id}`}><Edit2 size={14}/></button>
                            <button onClick={() => remove(ev.event_id)} className="text-red-400 hover:text-red-300 p-1.5 transition-colors" data-testid={`delete-${ev.event_id}`}><Trash2 size={14}/></button>
                          </td>
                        </tr>
                      ))}
                      {events.length === 0 && (
                        <tr><td colSpan="6" className="text-center py-10 text-[#727272]">No events yet. Add your first event.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="feedback">
              <h2 className="text-2xl font-black text-white tracking-tight mb-4">User Feedback</h2>
              <div className="bg-[#18002C] border border-[#46176D]/30 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="feedback-table">
                    <thead className="bg-[#280049] text-[#BF72FF] uppercase tracking-widest text-[10px]">
                      <tr>
                        <th className="text-left px-4 py-3">User</th>
                        <th className="text-left px-4 py-3">Rating</th>
                        <th className="text-left px-4 py-3">Feedback</th>
                        <th className="text-left px-4 py-3">Submitted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#46176D]/30">
                      {feedback.map((f) => (
                        <tr key={f.feedback_id} data-testid={`feedback-row-${f.feedback_id}`} className="hover:bg-[#280049]/40 transition-colors">
                          <td className="px-4 py-3 text-white font-medium align-top whitespace-nowrap">
                            {f.user_name || f.user_email}
                            <div className="text-[10px] text-[#727272] font-normal">{f.user_email}</div>
                          </td>
                          <td className="px-4 py-3 align-top whitespace-nowrap">
                            <span className="inline-flex items-center gap-0.5 text-[#F84E00]">
                              {[...Array(5)].map((_, i) => (
                                <Star key={`fb-${f.feedback_id}-star-${i}`} size={12} fill={i < f.star_rating ? "currentColor" : "none"} className={i < f.star_rating ? "" : "text-[#46176D]"}/>
                              ))}
                              <span className="ml-1 text-xs text-white">{f.star_rating}/5</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-white/90 max-w-md align-top">{f.feedback_text || <span className="text-[#727272] italic">—</span>}</td>
                          <td className="px-4 py-3 text-white/70 text-xs whitespace-nowrap align-top">
                            {f.submitted_at ? new Date(f.submitted_at).toLocaleString() : "—"}
                          </td>
                        </tr>
                      ))}
                      {feedback.length === 0 && (
                        <tr><td colSpan="4" className="text-center py-10 text-[#727272]">No feedback submitted yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="categories">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-black text-white tracking-tight">Manage Homepage Categories</h2>
              </div>
              <div className="bg-[#18002C] border border-[#46176D]/30 rounded-xl overflow-hidden p-6">
                {catLoading ? (
                  <p className="text-sm text-[#BF72FF]">Loading categories...</p>
                ) : homepageCategories.length === 0 ? (
                  <p className="text-sm text-[#727272]">No homepage categories found.</p>
                ) : (
                  <div className="space-y-3" data-testid="categories-list">
                    {homepageCategories.map((c) => (
                      <div
                        key={c}
                        data-testid={`category-item-${c}`}
                        className="flex items-center justify-between bg-[#280049]/40 border border-[#46176D]/30 rounded-lg p-3"
                      >
                        {editingCategory === c ? (
                          <div className="flex items-center gap-2 flex-1 mr-4">
                            <input
                              type="text"
                              data-testid={`category-input-${c}`}
                              value={editingCategoryName}
                              onChange={(e) => setEditingCategoryName(e.target.value)}
                              className="bg-[#0D0D0D] border border-[#BF72FF] rounded px-3 py-1.5 text-sm text-white focus:outline-none w-full max-w-sm"
                            />
                            <button
                              type="button"
                              data-testid={`category-save-${c}`}
                              onClick={() => saveCategoryRename(c)}
                              className="bg-[#F84E00] text-white px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider hover:bg-[#F84E00]/90 transition-colors"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCategory(null)}
                              className="bg-[#280049] text-[#BF72FF] px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider hover:text-white transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm font-medium text-white">{c}</span>
                        )}

                        <div className="flex items-center gap-2">
                          {editingCategory !== c && (
                            <button
                              type="button"
                              data-testid={`category-edit-${c}`}
                              onClick={() => startEditCategory(c)}
                              className="text-[#BF72FF] hover:text-white p-1.5 transition-colors"
                              title="Edit Category"
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                          <button
                            type="button"
                            data-testid={`category-delete-${c}`}
                            onClick={() => deleteCategory(c)}
                            className="text-red-400 hover:text-red-300 p-1.5 transition-colors"
                            title="Delete Category"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#18002C] border-[#46176D]/50 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">{editingId ? "Edit Event" : "Add New Event"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Event Title *"><input data-testid="form-title" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} className={inputCls}/></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <Select value={form.category} onValueChange={(v) => setForm({...form, category: v})}>
                  <SelectTrigger data-testid="form-category" className="bg-[#0D0D0D] border-[#46176D]/40 text-white"><SelectValue/></SelectTrigger>
                  <SelectContent className="bg-[#18002C] border-[#46176D] text-white">
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="focus:bg-[#280049] focus:text-white">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Mode">
                <Select value={form.mode} onValueChange={(v) => setForm({...form, mode: v})}>
                  <SelectTrigger data-testid="form-mode" className="bg-[#0D0D0D] border-[#46176D]/40 text-white"><SelectValue/></SelectTrigger>
                  <SelectContent className="bg-[#18002C] border-[#46176D] text-white">
                    {MODES.map((m) => <SelectItem key={m} value={m} className="focus:bg-[#280049] focus:text-white">{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Short Description (150 chars, shown on card)">
              <input data-testid="form-short" maxLength={150} value={form.short_description} onChange={(e) => setForm({...form, short_description: e.target.value})} className={inputCls}/>
            </Field>
            <Field label="Full Description">
              <textarea data-testid="form-full" rows={4} value={form.full_description} onChange={(e) => setForm({...form, full_description: e.target.value})} className={`${inputCls} resize-y`}/>
            </Field>
            <Field label="Event Image URL *"><input data-testid="form-image" value={form.image_url} onChange={(e) => setForm({...form, image_url: e.target.value})} className={inputCls}/></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Location"><input data-testid="form-location" value={form.location} onChange={(e) => setForm({...form, location: e.target.value})} className={inputCls}/></Field>
              <Field label="City">
                <Select value={form.city} onValueChange={(v) => setForm({...form, city: v})}>
                  <SelectTrigger data-testid="form-city" className="bg-[#0D0D0D] border-[#46176D]/40 text-white"><SelectValue/></SelectTrigger>
                  <SelectContent className="bg-[#18002C] border-[#46176D] text-white">
                    {CITIES.map((c) => <SelectItem key={c} value={c} className="focus:bg-[#280049] focus:text-white">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Event Date *"><input data-testid="form-date" type="date" value={form.event_date} onChange={(e) => setForm({...form, event_date: e.target.value})} className={inputCls}/></Field>
              <Field label="Start Time"><input data-testid="form-start" type="time" value={form.start_time} onChange={(e) => setForm({...form, start_time: e.target.value})} className={inputCls}/></Field>
              <Field label="End Time"><input data-testid="form-end" type="time" value={form.end_time} onChange={(e) => setForm({...form, end_time: e.target.value})} className={inputCls}/></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Registration Deadline"><input data-testid="form-deadline" type="date" value={form.registration_deadline} onChange={(e) => setForm({...form, registration_deadline: e.target.value})} className={inputCls}/></Field>
              <Field label="Total Seats"><input data-testid="form-seats" type="number" value={form.total_seats} onChange={(e) => setForm({...form, total_seats: e.target.value})} className={inputCls}/></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between bg-[#0D0D0D] rounded-lg px-4 py-3 border border-[#46176D]/40">
                <label className="text-xs font-bold uppercase tracking-widest text-[#BF72FF]">Paid Event</label>
                <Switch data-testid="form-paid" checked={form.is_paid} onCheckedChange={(v) => setForm({...form, is_paid: v})} className="data-[state=checked]:bg-[#F84E00]"/>
              </div>
              {form.is_paid && (
                <Field label="Price"><input data-testid="form-price" value={form.price} onChange={(e) => setForm({...form, price: e.target.value})} placeholder="₹299" className={inputCls}/></Field>
              )}
            </div>
            <Field label="External Registration Link *"><input data-testid="form-link" value={form.external_link} onChange={(e) => setForm({...form, external_link: e.target.value})} placeholder="https://..." className={inputCls}/></Field>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-widest text-[#BF72FF]">Skills You Will Learn (comma separated)</label>
                <button
                  type="button"
                  data-testid="generate-tags-btn"
                  onClick={handleGenerateTags}
                  disabled={generatingTags}
                  className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#BF72FF] hover:text-white border border-[#46176D]/60 hover:border-[#BF72FF] rounded-full px-2.5 py-1 transition-colors disabled:opacity-60"
                >
                  {generatingTags ? <Loader2 size={11} className="animate-spin"/> : <Wand2 size={11}/>}
                  Auto Generate
                </button>
              </div>
              <input data-testid="form-skills" value={skillsInput} onChange={(e) => setSkillsInput(e.target.value)} placeholder="Graphic Design, Color Theory" className={inputCls}/>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#BF72FF]">Recommended For</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {AUDIENCE.map((a) => (
                  <button key={a} data-testid={`aud-${a.toLowerCase()}`} onClick={() => toggleAudience(a)} className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider border transition-colors ${form.recommended_for.includes(a) ? "bg-[#F84E00] text-white border-[#F84E00]" : "bg-[#280049] text-[#BF72FF] border-transparent hover:border-[#46176D]"}`}>{a}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between bg-[#0D0D0D] rounded-lg px-4 py-3 border border-[#46176D]/40">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#BF72FF] block">Feature Event</label>
                <span className="text-[10px] text-[#727272]">Show in hero banner carousel</span>
              </div>
              <Switch data-testid="form-featured" checked={form.featured} onCheckedChange={(v) => setForm({...form, featured: v})} className="data-[state=checked]:bg-[#F84E00]"/>
            </div>

            <div className="bg-[#0D0D0D] rounded-lg p-4 border border-[#46176D]/40 space-y-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#BF72FF] block">Homepage Display</label>
                <span className="text-[10px] text-[#727272]">Choose how this event is displayed on the homepage</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="display-standard"
                  onClick={() => setDisplayType("standard")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                    displayType === "standard"
                      ? "bg-[#F84E00] text-white border-[#F84E00]"
                      : "bg-[#18002C] text-[#BF72FF] border-[#46176D]/40 hover:text-white"
                  }`}
                >
                  Standard Card
                </button>
                <button
                  type="button"
                  data-testid="display-existing"
                  onClick={() => setDisplayType("existing")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                    displayType === "existing"
                      ? "bg-[#F84E00] text-white border-[#F84E00]"
                      : "bg-[#18002C] text-[#BF72FF] border-[#46176D]/40 hover:text-white"
                  }`}
                >
                  Add to Existing Category Section
                </button>
                <button
                  type="button"
                  data-testid="display-new"
                  onClick={() => setDisplayType("new")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                    displayType === "new"
                      ? "bg-[#F84E00] text-white border-[#F84E00]"
                      : "bg-[#18002C] text-[#BF72FF] border-[#46176D]/40 hover:text-white"
                  }`}
                >
                  Create New Category Section
                </button>
              </div>

              {displayType === "existing" && (
                <div className="pt-2">
                  {catLoading ? (
                    <p className="text-xs text-[#BF72FF]">Loading categories…</p>
                  ) : catError ? (
                    <div className="space-y-1">
                      <p className="text-xs text-red-400">Failed to load categories. Enter category manually:</p>
                      <input
                        type="text"
                        data-testid="manual-category-input"
                        placeholder="e.g. Art Walks"
                        value={manualCategory}
                        onChange={(e) => setManualCategory(e.target.value)}
                        className="w-full bg-[#18002C] border border-[#46176D] rounded-lg px-3 py-2 text-sm text-white placeholder-[#727272] focus:outline-none focus:border-[#BF72FF]"
                      />
                    </div>
                  ) : homepageCategories.length === 0 ? (
                    <p className="text-xs text-[#727272]">No existing categories found. Switch to "Create New Category Section" to add one.</p>
                  ) : (
                    <select
                      data-testid="existing-category-select"
                      value={existingCategory}
                      onChange={(e) => setExistingCategory(e.target.value)}
                      className="w-full bg-[#18002C] border border-[#46176D] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#BF72FF]"
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
                  <input
                    type="text"
                    data-testid="new-category-input"
                    placeholder="Art Walks, Photography Events, College Fests"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="w-full bg-[#18002C] border border-[#46176D] rounded-lg px-3 py-2 text-sm text-white placeholder-[#727272] focus:outline-none focus:border-[#BF72FF]"
                  />
                  <p className="text-[10px] text-[#727272]">
                    This will create a new horizontal section on the homepage with this name. You can add more events to it later.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between bg-[#0D0D0D] rounded-lg px-4 py-3 border border-[#46176D]/40">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#BF72FF] block">Government Event</label>
                <span className="text-[10px] text-[#727272]">Also list under the Government Events section</span>
              </div>
              <Switch data-testid="form-government" checked={!!form.is_government} onCheckedChange={(v) => setForm({...form, is_government: v})} className="data-[state=checked]:bg-[#F84E00]"/>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setOpen(false)} className="flex-1 bg-[#280049] hover:bg-[#46176D] text-[#BF72FF] rounded-full px-5 py-3 text-sm font-bold transition-colors" data-testid="form-cancel">Cancel</button>
              <button onClick={save} data-testid="form-publish" className="flex-1 bg-[#F84E00] hover:bg-[#D14200] text-white rounded-full px-5 py-3 text-sm font-bold transition-colors">
                {editingId ? "Save Changes" : "Publish Event"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const inputCls = "w-full bg-[#0D0D0D] border border-[#46176D]/40 focus:border-[#F84E00] rounded-lg px-4 py-2.5 text-sm text-white placeholder-[#727272] outline-none transition-colors";

const Field = ({ label, children }) => (
  <div>
    <label className="text-xs font-bold uppercase tracking-widest text-[#BF72FF] block mb-2">{label}</label>
    {children}
  </div>
);

const StatCard = ({ testid, label, value, Icon }) => (
  <div data-testid={testid} className="bg-[#18002C] border border-[#46176D]/30 rounded-xl p-5 flex items-center gap-4">
    <div className="w-12 h-12 rounded-xl bg-[#280049] flex items-center justify-center text-[#BF72FF]">
      <Icon size={20}/>
    </div>
    <div>
      <div className="text-3xl font-black text-white tracking-tight">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-[#BF72FF] font-bold">{label}</div>
    </div>
  </div>
);

export default AdminPanel;
