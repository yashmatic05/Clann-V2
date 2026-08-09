import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import BottomTabBar from "@/components/BottomTabBar";
import HeroBanner from "@/components/HeroBanner";
import CategoryFilter, { chipToCategory } from "@/components/CategoryFilter";
import EventCard from "@/components/EventCard";
import WhatsAppReminderBar from "@/components/WhatsAppReminderBar";
import Footer from "@/components/Footer";
import MobileEventFeed from "@/components/MobileEventFeed";
import { useAuth } from "@/context/AuthContext";
import { Landmark } from "lucide-react";
import { daysBetween, parseDate } from "@/lib/event-utils";

const MODES = ["Both", "Online", "Offline"];

/**
 * Featured hero-banner selection.
 * Shows at most 6 banners that are most relevant to college students,
 * with registration deadlines within the next 7 days, capped at 4 free + 2
 * paid events. Admin-flagged `featured` events are prioritized first, then
 * remaining upcoming events fill the mix. Never shows the whole collection.
 */
export const selectFeaturedBanners = (allEvents) => {
  const isStudentRelevant = (ev) => {
    const recs = (ev.recommended_for || []).map((t) => String(t).toLowerCase());
    if (recs.length === 0) return false;
    return recs.some((t) => t === "all" || /student|college|university|campus/.test(t));
  };
  const deadlineWithinWeek = (ev) => {
    const deadline = parseDate(ev.registration_deadline) || parseDate(ev.event_date);
    if (!deadline) return false;
    const diff = daysBetween(deadline, new Date());
    return diff >= 0 && diff <= 7;
  };
  const sorted = (allEvents || [])
    .filter((ev) => !ev.is_government && isStudentRelevant(ev) && deadlineWithinWeek(ev))
    .sort((a, b) => {
      if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1;
      return String(a.registration_deadline || "").localeCompare(String(b.registration_deadline || ""));
    });
  const free = sorted.filter((e) => !e.is_paid).slice(0, 4);
  const paid = sorted.filter((e) => e.is_paid).slice(0, 2);
  return [...free, ...paid].slice(0, 6);
};

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [bannerPool, setBannerPool] = useState([]);
  const [govEvents, setGovEvents] = useState([]);
  const [savedIds, setSavedIds] = useState(new Set());
  const [category, setCategory] = useState("All");
  const [mode, setMode] = useState("Both");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/events");
        setBannerPool(data.filter((e) => !e.is_government));
      } catch (err) { console.error("[home] load banner pool failed", err); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/events", { params: { is_government: true } });
        setGovEvents(data);
      } catch (err) { console.error("[home] load government failed", err); }
    })();
  }, []);

  useEffect(() => {
    if (!user) { setSavedIds(new Set()); return; }
    (async () => {
      try {
        const { data } = await api.get("/saved");
        setSavedIds(new Set(data.map((e) => e.event_id)));
      } catch (err) { console.error("[home] load saved failed", err); }
    })();
  }, [user]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const params = {};
      const cat = chipToCategory(category);
      if (cat) params.category = cat;
      try {
        const { data } = await api.get("/events", { params });
        setEvents(data.filter((e) => !e.is_government));
      } catch (err) { console.error("[home] load events failed", err); }
      setLoading(false);
    })();
  }, [category]);

  const featuredBanners = useMemo(() => selectFeaturedBanners(bannerPool), [bannerPool]);

  // Live per-tab counts (non-government events, current category)
  const modeCounts = useMemo(() => {
    const online = events.filter((e) => e.mode === "Online" || e.mode === "Both");
    const offline = events.filter((e) => e.mode === "Offline" || e.mode === "Both");
    return { both: events.length, online: online.length, offline: offline.length };
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (mode === "Online") return events.filter((e) => e.mode === "Online" || e.mode === "Both");
    if (mode === "Offline") return events.filter((e) => e.mode === "Offline" || e.mode === "Both");
    return events;
  }, [events, mode]);

  const isAll = category === "All";

  const homepageSections = useMemo(() => {
    const map = new Map();
    for (const ev of filteredEvents) {
      const cat = (ev.homepage_category || "").trim();
      if (!cat) continue;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(ev);
    }
    const sections = [];
    for (const [title, evs] of map.entries()) {
      if (evs.length >= 1) {
        sections.push({ title, events: evs });
      }
    }
    sections.sort((a, b) => a.title.localeCompare(b.title));
    return sections;
  }, [filteredEvents]);

  return (
    <div className="min-h-screen bg-[#0D0D0D] pb-24 md:pb-6 overflow-x-hidden max-w-full">
      <Navbar />
      <HeroBanner events={featuredBanners} />
      <WhatsAppReminderBar testid="whatsapp-bar-home" />

      {/* Row 1 — Online / Offline mode toggle with live event counts */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="inline-flex bg-[#18002C] border border-[#46176D]/40 rounded-full p-1" data-testid="mode-toggle">
          {MODES.map((m) => (
            <button
              key={m}
              data-testid={`mode-${m.toLowerCase()}`}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full transition-colors ${
                mode === m ? "bg-[#F84E00] text-white" : "text-[#BF72FF] hover:text-white"
              }`}
            >
              {m} ({modeCounts[m.toLowerCase()]})
            </button>
          ))}
        </div>
      </div>

      {/* Row 2 — Category chips */}
      <CategoryFilter active={category} onChange={setCategory} />

      <section className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 md:mt-8 ${isAll && !loading && events.length > 0 ? "hidden md:block" : ""}`}>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={`skeleton-${i}`} className="bg-[#18002C] rounded-xl overflow-hidden border border-[#46176D]/30 animate-pulse">
                <div className="aspect-video bg-[#280049]" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-[#280049] rounded" />
                  <div className="h-3 bg-[#280049] rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div data-testid="empty-state" className="py-20 text-center text-[#727272]">
            <p className="text-lg font-bold text-white mb-1">No events found</p>
            <p className="text-sm">Try changing filters</p>
          </div>
        ) : (
          <div data-testid="event-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((ev, i) => (
              <EventCard
                key={ev.event_id}
                event={ev}
                index={i}
                initialSaved={savedIds.has(ev.event_id)}
              />
            ))}
          </div>
        )}
      </section>

      {govEvents.length > 0 && (
        <section className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-14 md:mt-20 ${isAll ? "hidden md:block" : ""}`} data-testid="government-section">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#46176D]/40 border border-[#BF72FF]/40 flex items-center justify-center text-[#BF72FF]">
              <Landmark size={18} />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Government Events</h2>
              <p className="text-xs text-[#727272]">Curated public sector programs and initiatives</p>
            </div>
          </div>
          <div data-testid="government-grid" className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {govEvents.map((ev, i) => (
              <EventCard
                key={ev.event_id}
                event={ev}
                index={500 + i}
                initialSaved={savedIds.has(ev.event_id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Mobile-only structured feed — shown only when the "All" chip is active (desktop never renders this) */}
      {isAll && !loading && (
        <MobileEventFeed events={filteredEvents} govEvents={govEvents} savedIds={savedIds} homepageSections={homepageSections} />
      )}

      <Footer />
      <BottomTabBar />
    </div>
  );
};

export default Home;
