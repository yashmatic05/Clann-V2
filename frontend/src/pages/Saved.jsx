import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import BottomTabBar from "@/components/BottomTabBar";
import EventCard from "@/components/EventCard";
import WhatsAppReminderBar from "@/components/WhatsAppReminderBar";
import { assignEventImages } from "@/lib/image-fallback";
import { Bookmark } from "lucide-react";

const Saved = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [events, setEvents] = useState([]);
  const [ready, setReady] = useState(false);
  const { map: imageMap, used: usedImages } = useMemo(
    () => assignEventImages(events),
    [events],
  );

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth"); return; }
    (async () => {
      try {
        const { data } = await api.get("/saved");
        setEvents(data);
      } catch (err) {
        console.error("[saved] load failed", err);
      }
      setReady(true);
    })();
  }, [user, loading, navigate]);

  const handleUnsave = (id) => {
    setEvents((prev) => prev.filter((e) => e.event_id !== id));
  };

  return (
    <div className="min-h-screen bg-[#0D0D0D] pb-24 md:pb-10">
      <Navbar />
      <WhatsAppReminderBar testid="whatsapp-bar-saved" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-2">
          <Bookmark className="text-[#F84E00]"/> Saved Events
        </h1>
        <p className="text-sm text-[#727272] mt-1">Events you've bookmarked to attend later.</p>

        {ready && events.length === 0 ? (
          <div className="mt-16 text-center" data-testid="saved-empty">
            <div className="mx-auto w-20 h-20 rounded-full bg-[#18002C] border border-[#46176D]/40 flex items-center justify-center mb-4">
              <Bookmark size={28} className="text-[#BF72FF]"/>
            </div>
            <p className="text-white font-bold text-lg mb-1">No saved events yet</p>
            <p className="text-sm text-[#727272]">Discover something interesting.</p>
            <Link to="/" data-testid="browse-events-btn" className="inline-block mt-5 bg-[#F84E00] hover:bg-[#D14200] text-white rounded-full px-6 py-3 text-sm font-bold transition-colors">
              Browse Events
            </Link>
          </div>
        ) : (
          <div data-testid="saved-grid" className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((ev, i) => (
              <EventCard
                key={ev.event_id}
                event={ev}
                index={i}
                initialSaved={true}
                onUnsave={handleUnsave}
                usedImages={usedImages}
                imageSrc={imageMap.get(ev.event_id)}
              />
            ))}
          </div>
        )}
      </div>
      <BottomTabBar/>
    </div>
  );
};

export default Saved;
