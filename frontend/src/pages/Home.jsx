import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
import { assignEventImages } from "@/lib/image-fallback";
import { Landmark, Megaphone } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MODES = ["Both", "Online", "Offline"];

/**
 * Featured hero-banner selection — admin-controlled (restored original behavior).
 * The admin's Featured Yes/No toggle in AdminPanel is the single source of truth.
 * No automatic rules: no banner limit, no free/paid ratio,
 * no student-relevance filter, no deadline window, no auto top-up.
 */
export const selectFeaturedBanners = (allEvents) => {
  return (allEvents || []).filter((ev) => ev.featured === true);
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

  // One shared image assignment for every event visible on this page (hero
  // slides, desktop grid, government grid, mobile feed): real images win on
  // their first occurrence; duplicates and blank image_urls get a stock
  // fallback that never repeats within the page.
  const { map: imageMap, used: usedImages } = useMemo(
    () => assignEventImages([...bannerPool, ...govEvents]),
    [bannerPool, govEvents],
  );

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
    <div className="min-h-screen bg-canvas overflow-x-hidden max-w-full">
      <Navbar />
      <HeroBanner events={featuredBanners} imageMap={imageMap} usedImages={usedImages} />
      <WhatsAppReminderBar testid="whatsapp-bar-home" />

      {/* Row 1 — Online / Offline mode toggle with live event counts */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="inline-flex bg-raised rounded-full p-1" data-testid="mode-toggle">
          {MODES.map((m) => (
            <button
              key={m}
              data-testid={`mode-${m.toLowerCase()}`}
              onClick={() => setMode(m)}
              className={`rounded-full px-4 min-h-9 t-button transition-colors duration-fast ease-standard ${
                mode === m ? "bg-selected text-on-selected" : "text-ink-2 hover:text-ink"
              }`}
            >
              {m} ({modeCounts[m.toLowerCase()]})
            </button>
          ))}
        </div>
      </div>

      {/* Row 2 — Category chips */}
      <CategoryFilter active={category} onChange={setCategory} />

      {/* Results block (desktop section + mobile feed) — animates as a unit on mode/category change. */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`mode-${mode}-${category}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
        >
          <section className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 md:mt-8 ${isAll && !loading && events.length > 0 ? "hidden md:block" : ""}`}>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={`skeleton-${i}`} className="bg-surface rounded-lg overflow-hidden border border-line animate-pulse">
                    <div className="aspect-video bg-raised" />
                    <div className="p-4 space-y-3">
                      <div className="h-4 bg-raised rounded-md" />
                      <div className="h-3 bg-raised rounded-md w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredEvents.length === 0 ? (
              <div data-testid="empty-state" className="py-16 text-center text-ink-muted">
                <p className="t-h3 text-ink mb-1">No events found</p>
                <p className="t-body">Try changing filters</p>
              </div>
            ) : (
              <div data-testid="event-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEvents.map((ev, i) => (
                  <EventCard
                    key={ev.event_id}
                    event={ev}
                    index={i}
                    initialSaved={savedIds.has(ev.event_id)}
                    usedImages={usedImages}
                    imageSrc={imageMap.get(ev.event_id)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Mobile-only structured feed — shown only when the "All" chip is active (desktop never renders this) */}
          {isAll && !loading && (
            <MobileEventFeed events={filteredEvents} govEvents={govEvents} savedIds={savedIds} homepageSections={homepageSections} usedImages={usedImages} imageMap={imageMap} />
          )}
        </motion.div>
      </AnimatePresence>

      {govEvents.length > 0 && (
        <section className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 md:mt-16 ${isAll ? "hidden md:block" : ""}`} data-testid="government-section">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-lg bg-raised border border-line flex items-center justify-center text-ink-muted">
              <Landmark size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="t-h2 text-ink">Government Events</h2>
              <p className="t-caption text-ink-muted">Curated public sector programs and initiatives</p>
            </div>
          </div>
          <div data-testid="government-grid" className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {govEvents.map((ev, i) => (
              <EventCard
                key={ev.event_id}
                event={ev}
                index={500 + i}
                initialSaved={savedIds.has(ev.event_id)}
                usedImages={usedImages}
                imageSrc={imageMap.get(ev.event_id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Organizer CTA — public submission workflow */}
      <section data-testid="organizer-cta" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 md:mt-16 pb-16 md:pb-6">
        <div className="rounded-lg border border-line bg-surface p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-raised border border-line flex items-center justify-center text-ink-muted shrink-0">
              <Megaphone size={24} strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="t-h2 text-ink">Organizing an event in Delhi?</h2>
              <p className="t-body text-ink-muted mt-1 max-w-md">
                List it on Clann — our team reviews every submission before it goes live on the platform.
              </p>
            </div>
          </div>
          <Link
            to="/organizer"
            data-testid="organizer-cta-btn"
            className={cn(buttonVariants({ variant: "primary", size: "md" }), "shrink-0")}
          >
            Submit Your Event
          </Link>
        </div>
      </section>

      <Footer />
      <BottomTabBar />
    </div>
  );
};

export default Home;
