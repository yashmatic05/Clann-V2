import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import BottomTabBar from "@/components/BottomTabBar";
import EventImage from "@/components/EventImage";
import { ChevronLeft, ChevronRight, CalendarDays, ExternalLink } from "lucide-react";

const monthName = (m) => new Date(2020, m, 1).toLocaleString("en-US", { month: "long" });

const startOfMonth = (y, m) => new Date(y, m, 1);
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

const CalendarPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth"); return; }
    (async () => {
      try {
        const { data } = await api.get("/registered");
        setEvents(data);
      } catch (err) {
        console.error("[calendar] load registered failed", err);
      }
    })();
  }, [user, loading, navigate]);

  // Group events by YYYY-MM-DD
  const eventsByDate = useMemo(() => {
    const m = {};
    for (const ev of events) {
      const key = ev.event_date; // stored as YYYY-MM-DD
      if (!key) continue;
      (m[key] ||= []).push(ev);
    }
    return m;
  }, [events]);

  const firstDay = startOfMonth(year, month).getDay(); // 0 Sun
  const total = daysInMonth(year, month);
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(d);

  const prev = () => { const d = new Date(year, month - 1, 1); setYear(d.getFullYear()); setMonth(d.getMonth()); setSelectedDate(null); };
  const next = () => { const d = new Date(year, month + 1, 1); setYear(d.getFullYear()); setMonth(d.getMonth()); setSelectedDate(null); };

  const dateKey = (d) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const selectedEvents = useMemo(
    () => (selectedDate ? (eventsByDate[selectedDate] || []) : []),
    [selectedDate, eventsByDate],
  );

  return (
    <div className="min-h-screen bg-canvas pb-16 md:pb-8">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <h1 className="t-h1 text-ink flex items-center gap-2">
          <CalendarDays size={24} strokeWidth={1.75} className="text-ink-muted"/> My Calendar
        </h1>
        <p className="t-body text-ink-muted mt-1">Events you've registered for, all in one view.</p>

        <div className="mt-6 bg-surface border border-line rounded-lg p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <button data-testid="cal-prev" onClick={prev} className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors duration-fast ease-standard hover:bg-raised">
              <ChevronLeft size={16} strokeWidth={1.75}/>
            </button>
            <h2 data-testid="cal-month" className="t-h2 text-ink">
              {monthName(month)} {year}
            </h2>
            <button data-testid="cal-next" onClick={next} className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors duration-fast ease-standard hover:bg-raised">
              <ChevronRight size={16} strokeWidth={1.75}/>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
              <div key={d} className="text-center t-caption font-bold text-ink-muted py-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {cells.map((d, i) => {
              if (d === null) return <div key={`e-${i}`} />;
              const key = dateKey(d);
              const dayEvents = eventsByDate[key] || [];
              const count = dayEvents.length;
              const overlap = count >= 2;
              const isToday = key === todayKey;
              const active = selectedDate === key;
              return (
                <button
                  key={key}
                  data-testid={`cal-day-${d}`}
                  onClick={() => count > 0 && setSelectedDate(active ? null : key)}
                  className={`aspect-square rounded-lg t-body font-bold flex flex-col items-center justify-center relative transition-colors duration-fast ease-standard border ${
                    active ? "bg-selected text-on-selected border-selected"
                    : overlap ? "bg-raised text-ink border-line-input hover:border-ink-2"
                    : count > 0 ? "bg-surface text-ink border-line hover:border-line-input"
                    : "bg-transparent text-ink-muted border-transparent hover:bg-raised"
                  } ${isToday && !active ? "ring-1 ring-cta" : ""}`}
                  title={overlap ? `${count} events on this day` : count === 1 ? `1 event` : ""}
                >
                  <span>{d}</span>
                  {count > 0 && !active && (
                    <span className="absolute bottom-1 h-2 w-2 rounded-full bg-cta"></span>
                  )}
                  {overlap && !active && (
                    <span className="absolute top-0 right-1 t-caption font-bold text-cta-text">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {selectedDate && (
            <div className="mt-4 bg-canvas border border-line rounded-lg p-4" data-testid="cal-day-panel">
              <div className="flex items-center justify-between">
                <p className="t-body-strong text-ink">
                  {selectedEvents.length} event{selectedEvents.length > 1 ? "s" : ""} on {selectedDate}
                </p>
                {selectedEvents.length >= 2 && (
                  <span className="inline-flex h-6 items-center rounded-full border border-cta/50 bg-cta/15 px-2 t-caption font-bold text-cta-text">
                    Overlap
                  </span>
                )}
              </div>
              <div className="mt-3 space-y-2">
                {selectedEvents.map((ev) => (
                  <Link
                    to={`/event/${ev.event_id}`}
                    key={ev.event_id}
                    data-testid={`cal-event-${ev.event_id}`}
                    className="flex items-center gap-3 bg-surface border border-line hover:border-line-input rounded-lg p-3 transition-colors duration-fast ease-standard group"
                  >
                    <EventImage event={ev} size="sm" className="h-12 w-12 rounded-md shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="t-body-strong text-ink truncate">{ev.title}</p>
                      <p className="t-caption text-ink-muted">{ev.start_time} – {ev.end_time} · {ev.location}</p>
                    </div>
                    <ExternalLink size={16} strokeWidth={1.75} className="shrink-0 text-ink-muted"/>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {events.length === 0 && (
            <p className="mt-6 text-center t-body text-ink-muted" data-testid="cal-empty">
              No registered events yet. Click <span className="text-cta-text font-bold">Register Now</span> on any event to add it here.
            </p>
          )}
        </div>
      </div>
      <BottomTabBar />
    </div>
  );
};

export default CalendarPage;
