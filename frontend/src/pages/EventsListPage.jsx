import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import BottomTabBar from "@/components/BottomTabBar";
import { MapPin, Calendar, ChevronLeft } from "lucide-react";
import { registrationStatus } from "@/lib/event-utils";
import { formatEventDateShort } from "@/lib/dates";
import { assignEventImages, eventImageHandlers } from "@/lib/image-fallback";

const categoryColor = (cat) => {
  const c = (cat || "").toLowerCase();
  if (c.includes("workshop")) return "bg-[#46176D]/60 text-[#BF72FF] border-[#BF72FF]/40";
  if (c.includes("hackathon")) return "bg-orange-500/15 text-orange-300 border-orange-400/40";
  if (c.includes("meetup")) return "bg-teal-500/15 text-teal-300 border-teal-400/40";
  if (c.includes("conference")) return "bg-blue-500/15 text-blue-300 border-blue-400/40";
  if (c.includes("walk")) return "bg-emerald-500/15 text-emerald-300 border-emerald-400/40";
  if (c.includes("art")) return "bg-pink-500/15 text-pink-300 border-pink-400/40";
  return "bg-[#46176D]/60 text-[#BF72FF] border-[#BF72FF]/40";
};

const RelatedEventCard = ({ event, usedImages, imageSrc }) => {
  const navigate = useNavigate();
  const status = registrationStatus(event);

  return (
    <div
      onClick={() => navigate(`/event/${event.event_id}`)}
      className="w-full h-[300px] bg-[#18002C] border border-[#46176D]/30 rounded-[12px] overflow-hidden cursor-pointer flex flex-col"
    >
      <img {...eventImageHandlers(event, usedImages, imageSrc)} alt={event.title} className="w-full h-[100px] object-cover bg-[#280049]" />
      <div className="p-[10px] flex flex-col gap-[6px] overflow-hidden flex-1">
        {/* Row 1 */}
        <div className="flex">
          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase whitespace-nowrap ${categoryColor(event.category)}`}>
            {event.category}
          </span>
        </div>

        {/* Row 2 */}
        <h4 className="text-[12px] font-bold text-white line-clamp-2 leading-tight">
          {event.title}
        </h4>

        {/* Row 3 */}
        <p className="flex items-center gap-1 text-[10px] text-[#727272] truncate">
          <MapPin size={10} className="shrink-0 text-[#BF72FF]" />
          <span className="truncate">
            {event.city}{event.location ? ` | ${event.location.split(",")[0]}` : ""}
          </span>
        </p>

        {/* Row 4 */}
        <p className="flex items-center gap-1 text-[10px] text-[#727272] truncate">
          <Calendar size={10} className="shrink-0 text-[#BF72FF]" />
          <span>{formatEventDateShort(event.event_date)}</span>
        </p>

        {/* Row 5 */}
        <p className={`text-[10px] font-semibold truncate ${status.tone === "urgent" ? "text-[#F84E00]" : "text-[#727272]"}`}>
          {status.text}
        </p>

        {/* Row 6 */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (event.external_link) {
              window.open(event.external_link, "_blank", "noopener,noreferrer");
            }
          }}
          className="mt-auto w-full h-[28px] bg-[#F84E00] text-white text-[11px] rounded-[20px] font-bold"
        >
          Register
        </button>
      </div>
    </div>
  );
};

const EventsListPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filter = searchParams.get("filter");
  const categoryParam = searchParams.get("category");

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const { map: imageMap, used: usedImages } = useMemo(
    () => assignEventImages(events),
    [events],
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        let params = {};
        if (categoryParam) {
          // fetch GET /api/events with params { homepage_category: category }
          params.homepage_category = categoryParam;
        } else if (filter) {
          if (filter === "upcoming") {
            // fetch GET /api/events sorted by event_date ascending
          } else if (filter === "government") {
            params.is_government = true;
          } else {
            params.category = filter;
          }
        }
        const { data } = await api.get("/events", { params });
        if (categoryParam) {
          setEvents(data.filter((e) => (e.homepage_category || "").trim() === categoryParam.trim()));
        } else {
          setEvents(data);
        }
      } catch (err) {
        console.error("[EventsListPage] fetch failed", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [filter, categoryParam]);

  const getPageTitle = () => {
    if (categoryParam) return categoryParam;
    if (!filter) return "Events";
    if (filter === "upcoming") return "Upcoming Events";
    if (filter === "government") return "Government Events";
    if (filter.toLowerCase() === "workshop") return "Workshops";
    if (filter.toLowerCase() === "hackathon") return "Hackathons";
    if (filter.toLowerCase() === "meetup") return "Meetups";
    if (filter.toLowerCase() === "art & sketch") return "Art & Sketch";
    if (filter.toLowerCase() === "conference") return "Conferences";
    if (filter.toLowerCase() === "walks" || filter.toLowerCase() === "walk") return "Walks";
    return filter;
  };

  return (
    <div className="min-h-screen bg-[#0D0D0D] pb-24">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 pt-6">
        {/* Back button */}
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-1 text-[#BF72FF] hover:text-white text-sm mb-6 transition-colors"
        >
          <ChevronLeft size={16} /> Back
        </button>

        {/* Title */}
        <h1 className="text-[28px] font-bold text-white mb-6 leading-tight">
          {getPageTitle()}
        </h1>

        {/* Grid or Skeletons or Empty state */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="h-[300px] bg-[#18002C] rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="py-20 text-center text-[#727272]">
            <p className="text-lg font-bold text-white mb-2">No events found</p>
            <button
              onClick={() => navigate("/")}
              className="mt-4 bg-[#F84E00] hover:bg-[#D14200] text-white rounded-full px-6 py-2.5 text-xs font-bold transition-colors"
            >
              Browse Events
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {events.map((ev) => (
              <RelatedEventCard key={ev.event_id} event={ev} usedImages={usedImages} imageSrc={imageMap.get(ev.event_id)} />
            ))}
          </div>
        )}
      </div>
      <BottomTabBar />
    </div>
  );
};

export default EventsListPage;
