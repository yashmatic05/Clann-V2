import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import BottomTabBar from "@/components/BottomTabBar";
import EventCard from "@/components/EventCard";
import WhatsAppReminderBar from "@/components/WhatsAppReminderBar";
import { Bookmark } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const Saved = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [events, setEvents] = useState([]);
  const [ready, setReady] = useState(false);

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
    <div className="min-h-screen bg-canvas pb-16 md:pb-8">
      <Navbar />
      <WhatsAppReminderBar testid="whatsapp-bar-saved" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <h1 className="t-h1 text-ink flex items-center gap-2">
          <Bookmark size={24} strokeWidth={1.75} className="text-ink-muted"/> Saved Events
        </h1>
        <p className="t-body text-ink-muted mt-1">Events you've bookmarked to attend later.</p>

        {ready && events.length === 0 ? (
          <div className="mt-16 text-center" data-testid="saved-empty">
            <div className="mx-auto h-20 w-20 rounded-full bg-surface border border-line flex items-center justify-center mb-4">
              <Bookmark size={28} strokeWidth={1.75} className="text-ink-muted"/>
            </div>
            <p className="t-h3 text-ink mb-1">No saved events yet</p>
            <p className="t-body text-ink-muted">Discover something interesting.</p>
            <Link to="/" data-testid="browse-events-btn" className={cn(buttonVariants({ variant: "primary", size: "md" }), "mt-4")}>
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
