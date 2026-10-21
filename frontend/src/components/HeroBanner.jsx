import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hasUsableImage } from "@/lib/event-image";
import { isExpiredEvent, eventDateDay } from "@/lib/dates";

/**
 * Continuous auto-sliding hero banner — image-only, no CTA button.
 * The whole banner is clickable and navigates to the event detail page (no auth required).
 * Supports drag/swipe on mouse & touch.
 *
 * The hero shows REAL event imagery only:
 *   - candidates are upcoming (not expired in India time) events with a usable,
 *     non-stock image_url;
 *   - every candidate is preloaded and must be genuinely wide (>= 800px and a
 *     width/height ratio of at least 1.5) or it is dropped silently;
 *   - if nothing passes, the hero renders nothing at all and the page content
 *     moves up — it never falls back to a placeholder or a stock photo.
 */

/** The hero is a very wide frame: small or portrait images would be cropped to nothing. */
export const HERO_MIN_WIDTH = 800;
export const HERO_MIN_RATIO = 1.5;
export const HERO_MAX_SLIDES = 5;
/** Show the flat loading block for at most this long, then give up. */
export const HERO_LOAD_TIMEOUT = 3000;

/**
 * The slides the hero may try to show, in order: featured events first (in the
 * order the admin's list supplies them), then the rest by soonest event date.
 * Expired and image-less events never qualify, whatever their featured flag.
 */
export const orderHeroCandidates = (events, max = HERO_MAX_SLIDES) => {
  const eligible = (events || []).filter(
    (ev) => ev && hasUsableImage(ev) && !isExpiredEvent(ev.event_date)
  );
  const featured = eligible.filter((ev) => ev.featured === true);
  const rest = eligible
    .filter((ev) => ev.featured !== true)
    .slice()
    .sort((a, b) => {
      const da = eventDateDay(a.event_date) || "9999-12-31";
      const db = eventDateDay(b.event_date) || "9999-12-31";
      if (da !== db) return da < db ? -1 : 1;
      return String(a.event_id || "").localeCompare(String(b.event_id || ""));
    });
  return [...featured, ...rest].slice(0, max);
};

/** True when a loaded image is wide enough for the hero frame. */
export const isHeroWorthy = (width, height) => {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return false;
  return w >= HERO_MIN_WIDTH && w / h >= HERO_MIN_RATIO;
};

const HeroBanner = ({ events }) => {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [approvedIds, setApprovedIds] = useState([]);
  const [settled, setSettled] = useState(false);
  const startX = useRef(0);
  const dragDistance = useRef(0);
  const pauseUntil = useRef(0);

  const candidates = useMemo(() => orderHeroCandidates(events), [events]);
  // Identity of the candidate list, so the preload effect only re-runs when the
  // actual set of images changes (not on every parent render).
  const candidateKey = candidates
    .map((ev) => `${ev.event_id}::${String(ev.image_url || "").trim()}`)
    .join("|");

  useEffect(() => {
    let cancelled = false;
    setApprovedIds([]);
    setSettled(false);

    if (candidates.length === 0) {
      setSettled(true);
      return () => {
        cancelled = true;
      };
    }

    let outstanding = candidates.length;
    const settleOne = () => {
      outstanding -= 1;
      if (outstanding <= 0 && !cancelled) setSettled(true);
    };
    const timer = setTimeout(() => {
      if (!cancelled) setSettled(true);
    }, HERO_LOAD_TIMEOUT);

    const probes = candidates.map((ev) => {
      const probe = new Image();
      probe.referrerPolicy = "no-referrer";
      probe.onload = () => {
        if (cancelled) return;
        if (isHeroWorthy(probe.naturalWidth, probe.naturalHeight)) {
          setApprovedIds((prev) => (prev.includes(ev.event_id) ? prev : [...prev, ev.event_id]));
        }
        settleOne();
      };
      probe.onerror = () => {
        if (!cancelled) settleOne();
      };
      probe.src = String(ev.image_url).trim();
      return probe;
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      probes.forEach((probe) => {
        probe.onload = null;
        probe.onerror = null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateKey]);

  // Slides stay in candidate order (featured first) no matter which probe
  // finished loading first.
  const slides = useMemo(() => {
    const approved = new Set(approvedIds);
    return candidates.filter((ev) => approved.has(ev.event_id));
  }, [candidates, approvedIds]);

  const n = slides.length;

  const goto = useCallback(
    (delta) => {
      if (n === 0) return;
      setIdx((i) => (i + delta + n) % n);
    },
    [n]
  );

  useEffect(() => {
    if (n === 0) return;
    const t = setInterval(() => {
      if (Date.now() < pauseUntil.current) return;
      setIdx((i) => (i + 1) % n);
    }, 4500);
    return () => clearInterval(t);
  }, [n]);

  const onPointerDown = (e) => {
    setDragging(true);
    dragDistance.current = 0;
    startX.current = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    pauseUntil.current = Date.now() + 6000;
  };
  const onPointerMove = (e) => {
    if (!dragging) return;
    const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const dx = x - startX.current;
    dragDistance.current = Math.abs(dx);
    setDragX(dx);
  };
  const finalizeDrag = () => {
    if (!dragging) return;
    const threshold = 60;
    if (dragX > threshold) goto(-1);
    else if (dragX < -threshold) goto(1);
    setDragging(false);
    setDragX(0);
  };

  const handleBannerClick = (evId) => {
    // ignore click if it was actually a drag
    if (dragDistance.current > 8) return;
    navigate(`/event/${evId}`);
  };

  // No slide has passed yet: hold the hero's exact size with a flat block so
  // the page does not jump, then disappear if nothing ever qualifies.
  if (n === 0) {
    if (settled) return null;
    return (
      <section data-testid="hero-banner-loading" className="relative w-full select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 md:pt-8">
          <div
            className="rounded-lg overflow-hidden aspect-[16/9] sm:aspect-[21/9] bg-raised"
            aria-hidden="true"
          />
        </div>
      </section>
    );
  }

  const safeIdx = idx % n;

  return (
    <section data-testid="hero-banner" className="relative w-full select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 md:pt-8">
        <div
          className="relative rounded-lg overflow-hidden aspect-[16/9] sm:aspect-[21/9] bg-raised cursor-pointer touch-pan-y"
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onMouseUp={finalizeDrag}
          onMouseLeave={finalizeDrag}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
          onTouchEnd={finalizeDrag}
        >
          <div
            className="absolute inset-0 flex will-change-transform"
            style={{
              width: `${n * 100}%`,
              transform: `translate3d(calc(${-safeIdx * (100 / n)}% + ${dragX}px), 0, 0)`,
              transition: dragging ? "none" : "transform 800ms cubic-bezier(0.22, 0.61, 0.36, 1)",
            }}
            data-testid="hero-track"
          >
            {slides.map((ev, i) => (
              <button
                key={ev.event_id}
                type="button"
                onClick={() => handleBannerClick(ev.event_id)}
                className="relative block text-left"
                style={{ width: `${100 / n}%`, flex: `0 0 ${100 / n}%` }}
                data-testid={`hero-slide-${i}`}
                aria-label={`Open ${ev.title}`}
              >
                <img
                  src={String(ev.image_url).trim()}
                  alt={ev.title}
                  referrerPolicy="no-referrer"
                  decoding="async"
                  loading={i === 0 ? "eager" : "lazy"}
                  draggable={false}
                  className="w-full h-full object-cover pointer-events-none"
                />
              </button>
            ))}
          </div>

          {/* Dot indicators — R2: the active dot uses selected, never orange. */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {slides.map((ev, i) => (
              <button
                key={`dot-${ev.event_id}`}
                data-testid={`hero-dot-${i}`}
                onClick={(e) => { e.stopPropagation(); pauseUntil.current = Date.now() + 6000; setIdx(i); }}
                aria-label={`Slide ${i + 1}`}
                className={`h-2 rounded-full transition-[width,background-color] duration-standard ease-standard ${i === safeIdx ? "w-8 bg-selected" : "w-2 bg-canvas/50 hover:bg-canvas/80"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroBanner;
