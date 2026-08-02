import React, { useEffect, useMemo, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import BottomTabBar from "@/components/BottomTabBar";
import EventCard from "@/components/EventCard";
import { useAuth } from "@/context/AuthContext";

const Search = () => {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [all, setAll] = useState([]);
  const [savedIds, setSavedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/events");
        setAll(data);
      } catch (err) { console.error("[search] load failed", err); }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data } = await api.get("/saved");
        setSavedIds(new Set(data.map((e) => e.event_id)));
      } catch (err) { console.error("[search] load saved failed", err); }
    })();
  }, [user]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return all;
    return all.filter((e) =>
      (e.title || "").toLowerCase().includes(s) ||
      (e.short_description || "").toLowerCase().includes(s) ||
      (e.full_description || "").toLowerCase().includes(s) ||
      (e.category || "").toLowerCase().includes(s) ||
      (e.city || "").toLowerCase().includes(s)
    );
  }, [q, all]);

  return (
    <div className="min-h-screen bg-[#0D0D0D] pb-24 md:pb-10">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-2">
          <SearchIcon className="text-[#F84E00]"/> Search Events
        </h1>
        <p className="text-sm text-[#727272] mt-1">Find events by name, category, city, or keyword.</p>

        <div className="mt-6 relative">
          <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#727272]" />
          <input
            data-testid="search-input"
            autoFocus
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search events, workshops, meetups..."
            className="w-full bg-[#18002C] border border-[#46176D]/40 focus:border-[#F84E00] rounded-full pl-11 pr-4 py-3 text-sm text-white placeholder-[#727272] outline-none transition-colors"
          />
        </div>

        <p className="mt-4 text-xs text-[#727272]" data-testid="search-count">{loading ? "Loading..." : `${results.length} results`}</p>

        <div data-testid="search-grid" className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {results.map((ev, i) => (
            <EventCard
              key={ev.event_id}
              event={ev}
              index={i}
              initialSaved={savedIds.has(ev.event_id)}
            />
          ))}
        </div>

        {!loading && results.length === 0 && (
          <div className="py-16 text-center text-[#727272]" data-testid="search-empty">
            <p className="text-white font-bold text-lg mb-1">No matches</p>
            <p className="text-sm">Try a different keyword.</p>
          </div>
        )}
      </div>
      <BottomTabBar />
    </div>
  );
};

export default Search;
