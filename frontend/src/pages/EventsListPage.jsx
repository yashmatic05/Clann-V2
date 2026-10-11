import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import BottomTabBar from "@/components/BottomTabBar";
import { MapPin, Calendar, ChevronLeft } from "lucide-react";
import { registrationStatus } from "@/lib/event-utils";
import { formatEventDateShort } from "@/lib/dates";
import { assignEventImages, eventImageHandlers } from "@/lib/image-fallback";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Category chips are uniform (R2) — same decision as EventCard and
 * CompactEventCard: no hex codes, no palette names, one accent per card.
 */
const categoryColor = (cat) => {
  const c = (cat || "").toLowerCase();
  if (c.includes("workshop")) return "bg-chip text-ink border-line";
  if (c.includes("hackathon")) return "bg-chip text-ink border-line";
  if (c.includes("meetup")) return "bg-chip text-ink border-line";
  if (c.includes("conference")) return "bg-chip text-ink border-line";
  if (c.includes("walk")) return "bg-chip text-ink border-line";
  if (c.includes("art")) return "bg-chip text-ink border-line";
  return "bg-chip text-ink border-line";
};

const chipClass =
  "inline-flex h-6 shrink-0 items-center rounded-md border px-1 t-caption font-semibold whitespace-nowrap";

const RelatedEventCard = ({ event, usedImages, imageSrc }) => {
  const navigate = useNavigate();
  const status = registrationStatus(event);

  return (
    <div
      onClick={() => navigate(`/event/${event.event_id}`)}
      className="w-full h-[300px] bg-surface border border-line hover:border-line-input rounded-lg overflow-hidden cursor-pointer flex flex-col transition-colors duration-fast ease-standard"
    >
      <img {...eventImageHandlers(event, usedImages, imageSrc)} alt={event.title} className="w-full h-[100px] object-cover bg-raised" />
      <div className="p-2 flex flex-col gap-1 overflow-hidden flex-1">
        {/* Row 1 */}
        <div className="flex">
          <span className={`${chipClass} ${categoryColor(event.category)}`}>
            {event.category}
          </span>
        </div>

        {/* Row 2 */}
        <h4 className="t-caption font-bold text-ink line-clamp-2">
          {event.title}
        </h4>

        {/* Row 3 */}
        <p className="flex items-center gap-1 t-caption text-ink-2 truncate">
          <MapPin size={16} strokeWidth={1.75} className="shrink-0 text-ink-muted" />
          <span className="truncate">
            {event.city}{event.location ? ` | ${event.location.split(",")[0]}` : ""}
          </span>
        </p>

        {/* Row 4 */}
        <p className="flex items-center gap-1 t-caption text-ink-2 truncate">
          <Calendar size={16} strokeWidth={1.75} className="shrink-0 text-ink-muted" />
          <span>{formatEventDateShort(event.event_date)}</span>
        </p>

        {/* Row 5 */}
        <p className={cn("t-caption font-semibold truncate", status.tone === "urgent" ? "text-danger" : "text-ink-muted")}>
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
          className={cn(buttonVariants({ variant: "primary", size: "sm" }), "mt-auto w-full")}
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
    <div className="min-h-screen bg-canvas pb-16">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 pt-6">
        {/* Back button */}
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-1 t-body text-ink-2 hover:text-ink mb-6 transition-colors duration-fast ease-standard"
        >
          <ChevronLeft size={16} strokeWidth={1.75} /> Back
        </button>

        {/* Title */}
        <h1 className="t-h1 text-ink mb-6">
          {getPageTitle()}
        </h1>

        {/* Grid or Skeletons or Empty state */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="h-[300px] bg-raised rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="py-16 text-center text-ink-muted">
            <p className="t-h3 text-ink mb-2">No events found</p>
            <button
              onClick={() => navigate("/")}
              className={cn(buttonVariants({ variant: "primary", size: "sm" }), "mt-4")}
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
