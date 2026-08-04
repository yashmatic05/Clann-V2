import React, { useMemo } from "react";
import EventCard from "@/components/EventCard";
import CompactEventCard from "@/components/CompactEventCard";

// Section heading: white bold 18px title left, orange "See All →" right
const SectionHeading = ({ title }) => (
  <div className="flex items-center justify-between">
    <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
    <span className="text-xs font-bold text-[#F84E00]">See All →</span>
  </div>
);

// Horizontal scrollable row of compact cards — 16px left padding, 12px gap,
// no visible scrollbar, smooth iOS touch scroll
const HorizontalRow = ({ events }) => (
  <div className="mt-3 flex gap-3 overflow-x-auto scrollbar-hide [-webkit-overflow-scrolling:touch] px-4 pb-1">
    {events.map((ev, i) => (
      <CompactEventCard key={ev.event_id} event={ev} index={i} />
    ))}
  </div>
);

const HorizontalSection = ({ title, events }) => {
  if (events.length === 0) return null;
  return (
    <section className="mt-8">
      <div className="px-4">
        <SectionHeading title={title} />
      </div>
      <HorizontalRow events={events} />
    </section>
  );
};

// Vertical stack of full-width EventCards — the exact existing component
const VerticalBlock = ({ events, startIndex, savedIds }) => {
  if (events.length === 0) return null;
  return (
    <div className="px-4 flex flex-col gap-4">
      {events.map((ev, i) => (
        <EventCard
          key={ev.event_id}
          event={ev}
          index={startIndex + i}
          initialSaved={savedIds.has(ev.event_id)}
        />
      ))}
    </div>
  );
};

/**
 * Mobile-only structured homepage feed (screens below md / 768px).
 * Block order: 2 vertical cards → Government row → 2 vertical cards →
 * Upcoming row (10) → 2 vertical cards → Workshops row → 2 vertical cards →
 * Hackathons row → remaining vertical cards.
 *
 * Deduplication: a Set tracks every shown event_id — an event shown in a
 * vertical pair never repeats in a horizontal row, and no event appears in
 * two horizontal rows.
 */
const MobileEventFeed = ({ events, govEvents, savedIds, homepageSections = [] }) => {
  const feed = useMemo(() => {
    const shown = new Set();

    // Take up to n events from arr that haven't been shown yet (marks them shown)
    const take = (arr, n) => {
      const out = [];
      for (const ev of arr) {
        if (out.length >= n) break;
        if (shown.has(ev.event_id)) continue;
        shown.add(ev.event_id);
        out.push(ev);
      }
      return out;
    };

    const notShown = (arr) => arr.filter((ev) => !shown.has(ev.event_id));

    // Block 1 — first 2 events
    const block1 = take(events, 2);

    // Block 2 — Government Events (is_government === true)
    const govList = notShown(govEvents);
    govList.forEach((ev) => shown.add(ev.event_id));

    // Block 3 — next 2 events
    const block3 = take(events, 2);

    // Block 4 — Upcoming Events: next 10 by event_date (events are pre-sorted), excluding blocks 1 & 3
    const block4 = take(events, 10);

    // Block 5 — next 2 events
    const block5 = take(events, 2);

    // Block 6 — Workshops (exclude anything already shown)
    const block6 = take(notShown(events.filter((ev) => ev.category === "Workshop")), events.length);

    // Block 7 — next 2 events
    const block7 = take(events, 2);

    // Block 8 — Hackathons & Competitions (exclude anything already shown)
    const block8 = take(notShown(events.filter((ev) => ev.category === "Hackathon")), events.length);

    // Dynamic homepage category sections (appear after hardcoded sections, before Remaining Events)
    // Only keep category groups with at least 2 available/not-already-shown events after deduplication.
    const dynamicSections = [];
    for (const sec of homepageSections || []) {
      const avail = notShown(sec.events);
      if (avail.length >= 2) {
        avail.forEach((ev) => shown.add(ev.event_id));
        dynamicSections.push({ title: sec.title, events: avail });
      }
    }

    // Block 9 — everything remaining
    const block9 = notShown(events);

    return { block1, govList, block3, block4, block5, block6, block7, block8, dynamicSections, block9 };
  }, [events, govEvents, homepageSections]);

  return (
    <div className="md:hidden" data-testid="mobile-event-feed">
      {/* Block 1 — 2 full-width cards */}
      {feed.block1.length > 0 && (
        <div className="mt-6">
          <VerticalBlock events={feed.block1} startIndex={1000} savedIds={savedIds} />
        </div>
      )}

      {/* Block 2 — Government Events (hidden if fewer than 2) */}
      {feed.govList.length >= 2 && (
        <HorizontalSection title="Government Events" events={feed.govList} />
      )}

      {/* Block 3 — 2 full-width cards */}
      {feed.block3.length > 0 && (
        <div className="mt-8">
          <VerticalBlock events={feed.block3} startIndex={1002} savedIds={savedIds} />
        </div>
      )}

      {/* Block 4 — Upcoming Events (next 10) */}
      <HorizontalSection title="Upcoming Events" events={feed.block4} />

      {/* Block 5 — 2 full-width cards */}
      {feed.block5.length > 0 && (
        <div className="mt-8">
          <VerticalBlock events={feed.block5} startIndex={1004} savedIds={savedIds} />
        </div>
      )}

      {/* Block 6 — Workshops (hidden if fewer than 2) */}
      {feed.block6.length >= 2 && (
        <HorizontalSection title="Workshops" events={feed.block6} />
      )}

      {/* Block 7 — 2 full-width cards */}
      {feed.block7.length > 0 && (
        <div className="mt-8">
          <VerticalBlock events={feed.block7} startIndex={1006} savedIds={savedIds} />
        </div>
      )}

      {/* Block 8 — Hackathons & Competitions (hidden if fewer than 2) */}
      {feed.block8.length >= 2 && (
        <HorizontalSection title="Hackathons & Competitions" events={feed.block8} />
      )}

      {/* Dynamic homepage category sections */}
      {feed.dynamicSections.map((sec) => (
        <HorizontalSection key={sec.title} title={sec.title} events={sec.events} />
      ))}

      {/* Block 9 — any remaining events */}
      {feed.block9.length > 0 && (
        <div className="mt-8">
          <VerticalBlock events={feed.block9} startIndex={1008} savedIds={savedIds} />
        </div>
      )}
    </div>
  );
};

export default MobileEventFeed;
