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
const HorizontalRow = ({ events, savedIds }) => (
  <div className="mt-3 flex gap-3 overflow-x-auto scrollbar-hide [-webkit-overflow-scrolling:touch] px-4 pb-1">
    {events.map((ev, i) => (
      <CompactEventCard
        key={ev.event_id}
        event={ev}
        index={i}
        initialSaved={savedIds ? savedIds.has(ev.event_id) : false}
      />
    ))}
  </div>
);

const HorizontalSection = ({ title, events, savedIds }) => {
  if (events.length === 0) return null;
  return (
    <section className="mt-8 overflow-x-hidden max-w-full">
      <div className="px-4">
        <SectionHeading title={title} />
      </div>
      <div className="overflow-hidden overflow-x-hidden max-w-full">
        <HorizontalRow events={events} savedIds={savedIds} />
      </div>
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
 * Layout: alternating pattern of stacked full-width EventCard pairs and
 * horizontal scroll sections for categorized events.
 *
 * Order: pair → Upcoming → pair → Government → pair → Workshops → pair →
 * Hackathons → pair → Meetups → pair → custom homepage_category sections →
 * remaining events as stacked cards.
 *
 * Deduplication: a single Set tracks every shown event_id across ALL sections.
 * Custom homepage_category events are reserved BEFORE hardcoded sections
 * consume events, so they never appear in both a custom section and a
 * hardcoded section.
 */
const MobileEventFeed = ({ events, govEvents, savedIds, homepageSections = [] }) => {
  const feed = useMemo(() => {
    const shown = new Set();

    // Pre-exclusion: reserve custom homepage_category events before hardcoded
    // sections so they are completely excluded from all hardcoded sections
    // and stacked pairs.
    for (const sec of homepageSections || []) {
      for (const ev of sec.events) {
        shown.add(ev.event_id);
      }
    }

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

    // 1. 2 stacked full width EventCards
    const pair1 = take(events, 2);

    // 2. Upcoming Events horizontal scroll section
    const upcoming = take(events, 10);

    // 3. 2 stacked full width EventCards
    const pair2 = take(events, 2);

    // 4. Government Events horizontal scroll section
    const govList = take(notShown(govEvents), govEvents.length);

    // 5. 2 stacked full width EventCards
    const pair3 = take(events, 2);

    // 6. Workshops horizontal scroll section
    const workshops = take(notShown(events.filter((ev) => ev.category === "Workshop")), events.length);

    // 7. 2 stacked full width EventCards
    const pair4 = take(events, 2);

    // 8. Hackathons horizontal scroll section
    const hackathons = take(notShown(events.filter((ev) => ev.category === "Hackathon" || ev.category === "Hackathons & Competitions")), events.length);

    // 9. 2 stacked full width EventCards
    const pair5 = take(events, 2);

    // 10. Meetups horizontal scroll section
    const meetups = take(notShown(events.filter((ev) => ev.category === "Meetup")), events.length);

    // 11. 2 stacked full width EventCards
    const pair6 = take(events, 2);

    // 12. Custom homepage_category sections (at least 1 event)
    const customSections = (homepageSections || []).filter((sec) => sec.events && sec.events.length >= 1);

    // 13. Remaining events as stacked cards
    const remaining = notShown(events);

    return {
      pair1,
      upcoming,
      pair2,
      govList,
      pair3,
      workshops,
      pair4,
      hackathons,
      pair5,
      meetups,
      pair6,
      customSections,
      remaining,
    };
  }, [events, govEvents, homepageSections]);

  return (
    <div className="md:hidden overflow-x-hidden max-w-full" data-testid="mobile-event-feed">
      {/* 2 stacked full width EventCards */}
      {feed.pair1.length > 0 && (
        <div className="mt-6">
          <VerticalBlock events={feed.pair1} startIndex={1000} savedIds={savedIds} />
        </div>
      )}

      {/* Upcoming Events horizontal scroll section */}
      {feed.upcoming.length > 0 && (
        <HorizontalSection title="Upcoming Events" events={feed.upcoming} savedIds={savedIds} />
      )}

      {/* 2 stacked full width EventCards */}
      {feed.pair2.length > 0 && (
        <div className="mt-8">
          <VerticalBlock events={feed.pair2} startIndex={1010} savedIds={savedIds} />
        </div>
      )}

      {/* Government Events horizontal scroll section */}
      {feed.govList.length > 0 && (
        <HorizontalSection title="Government Events" events={feed.govList} savedIds={savedIds} />
      )}

      {/* 2 stacked full width EventCards */}
      {feed.pair3.length > 0 && (
        <div className="mt-8">
          <VerticalBlock events={feed.pair3} startIndex={1020} savedIds={savedIds} />
        </div>
      )}

      {/* Workshops horizontal scroll section */}
      {feed.workshops.length > 0 && (
        <HorizontalSection title="Workshops" events={feed.workshops} savedIds={savedIds} />
      )}

      {/* 2 stacked full width EventCards */}
      {feed.pair4.length > 0 && (
        <div className="mt-8">
          <VerticalBlock events={feed.pair4} startIndex={1030} savedIds={savedIds} />
        </div>
      )}

      {/* Hackathons horizontal scroll section */}
      {feed.hackathons.length > 0 && (
        <HorizontalSection title="Hackathons & Competitions" events={feed.hackathons} savedIds={savedIds} />
      )}

      {/* 2 stacked full width EventCards */}
      {feed.pair5.length > 0 && (
        <div className="mt-8">
          <VerticalBlock events={feed.pair5} startIndex={1040} savedIds={savedIds} />
        </div>
      )}

      {/* Meetups horizontal scroll section */}
      {feed.meetups.length > 0 && (
        <HorizontalSection title="Meetups" events={feed.meetups} savedIds={savedIds} />
      )}

      {/* 2 stacked full width EventCards */}
      {feed.pair6.length > 0 && (
        <div className="mt-8">
          <VerticalBlock events={feed.pair6} startIndex={1050} savedIds={savedIds} />
        </div>
      )}

      {/* Custom homepage_category sections */}
      {feed.customSections.map((sec) => (
        <HorizontalSection key={sec.title} title={sec.title} events={sec.events} savedIds={savedIds} />
      ))}

      {/* Remaining events as stacked cards */}
      {feed.remaining.length > 0 && (
        <div className="mt-8">
          <VerticalBlock events={feed.remaining} startIndex={1060} savedIds={savedIds} />
        </div>
      )}
    </div>
  );
};

export default MobileEventFeed;
