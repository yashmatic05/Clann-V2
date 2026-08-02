import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Continuous auto-sliding hero banner — image-only, no CTA button.
 * The whole banner is clickable and navigates to the event detail page (no auth required).
 * Supports drag/swipe on mouse & touch.
 */
const HeroBanner = ({ events }) => {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const dragDistance = useRef(0);
  const pauseUntil = useRef(0);

  const n = events?.length || 0;

  const goto = useCallback((delta) => {
    if (n === 0) return;
    setIdx((i) => (i + delta + n) % n);
  }, [n]);

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

  if (!n) return null;

  return (
    <section data-testid="hero-banner" className="relative w-full select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 md:pt-10">
        <div
          className="relative rounded-2xl overflow-hidden aspect-[16/9] sm:aspect-[21/9] bg-[#18002C] cursor-pointer touch-pan-y"
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
              transform: `translate3d(calc(${-idx * (100 / n)}% + ${dragX}px), 0, 0)`,
              transition: dragging ? "none" : "transform 800ms cubic-bezier(0.22, 0.61, 0.36, 1)",
            }}
            data-testid="hero-track"
          >
            {events.map((ev, i) => (
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
                  src={ev.image_url}
                  alt={ev.title}
                  draggable={false}
                  className="w-full h-full object-cover pointer-events-none"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0D0D0D]/25 via-transparent to-[#0D0D0D]/25" />
              </button>
            ))}
          </div>

          {/* Dot indicators */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {events.map((ev, i) => (
              <button
                key={`dot-${ev.event_id}`}
                data-testid={`hero-dot-${i}`}
                onClick={(e) => { e.stopPropagation(); pauseUntil.current = Date.now() + 6000; setIdx(i); }}
                aria-label={`Slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === idx ? "w-8 bg-[#F84E00]" : "w-2 bg-white/40 hover:bg-white/70"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroBanner;
