import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import BottomTabBar from "@/components/BottomTabBar";
import { assignEventImages, eventImageHandlers } from "@/lib/image-fallback";
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
  // Display-only image assignment for the day's event thumbnails.
  const { map: imageMap, used: usedImages } = useMemo(
    () => assignEventImages(selectedEvents),
    [selectedEvents],
  );

  return (
    <div className="min-h-screen bg-[#0D0D0D] pb-24 md:pb-10">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-2">
          <CalendarDays className="text-[#F84E00]"/> My Calendar
        </h1>
        <p className="text-sm text-[#727272] mt-1">Events you've registered for, all in one view.</p>

        <div className="mt-6 bg-[#18002C] border border-[#46176D]/30 rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <button data-testid="cal-prev" onClick={prev} className="p-2 rounded-full bg-[#280049] hover:bg-[#46176D] text-[#BF72FF] transition-colors">
              <ChevronLeft size={16}/>
            </button>
            <h2 data-testid="cal-month" className="text-lg sm:text-xl font-black text-white tracking-tight">
              {monthName(month)} {year}
            </h2>
            <button data-testid="cal-next" onClick={next} className="p-2 rounded-full bg-[#280049] hover:bg-[#46176D] text-[#BF72FF] transition-colors">
              <ChevronRight size={16}/>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
              <div key={d} className="text-center text-[10px] font-bold uppercase tracking-widest text-[#BF72FF] py-2">{d}</div>
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
                  className={`aspect-square rounded-lg text-sm font-bold flex flex-col items-center justify-center relative transition-colors border ${
                    active ? "bg-[#F84E00] text-white border-[#F84E00]"
                    : overlap ? "bg-amber-500/10 text-amber-200 border-amber-400/40 hover:bg-amber-500/20"
                    : count > 0 ? "bg-[#280049] text-white border-[#46176D]/60 hover:bg-[#46176D]"
                    : "bg-transparent text-[#727272] border-transparent hover:bg-[#280049]/40"
                  } ${isToday && !active ? "ring-1 ring-[#F84E00]" : ""}`}
                  title={overlap ? `${count} events on this day` : count === 1 ? `1 event` : ""}
                >
                  <span>{d}</span>
                  {count > 0 && !active && (
                    <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${overlap ? "bg-amber-400" : "bg-[#F84E00]"}`}></span>
                  )}
                  {overlap && !active && (
                    <span className="absolute top-0.5 right-1 text-[9px] font-black text-amber-300">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {selectedDate && (
            <div className="mt-5 bg-[#0D0D0D] border border-[#46176D]/40 rounded-xl p-4" data-testid="cal-day-panel">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-white">
                  {selectedEvents.length} event{selectedEvents.length > 1 ? "s" : ""} on {selectedDate}
                </p>
                {selectedEvents.length >= 2 && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300 bg-amber-500/10 border border-amber-400/40 rounded-full px-2 py-0.5">
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
                    className="flex items-center gap-3 bg-[#18002C] border border-[#46176D]/30 hover:border-[#46176D] rounded-lg p-3 transition-colors group"
                  >
                    <img {...eventImageHandlers(ev, usedImages, imageMap.get(ev.event_id))} alt="" className="w-12 h-12 rounded-lg object-cover"/>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate group-hover:text-[#F84E00] transition-colors">{ev.title}</p>
                      <p className="text-[11px] text-[#727272]">{ev.start_time} – {ev.end_time} · {ev.location}</p>
                    </div>
                    <ExternalLink size={14} className="text-[#BF72FF]"/>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {events.length === 0 && (
            <p className="mt-6 text-center text-sm text-[#727272]" data-testid="cal-empty">
              No registered events yet. Click <span className="text-[#F84E00] font-bold">Register Now</span> on any event to add it here.
            </p>
          )}
        </div>
      </div>
      <BottomTabBar />
    </div>
  );
};

export default CalendarPage;
