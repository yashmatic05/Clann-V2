import React from "react";
import { motion } from "framer-motion";

export const CATEGORIES = [
  "All", "Workshops", "Meetups", "Hackathons", "Conferences", "Walks", "Art & Sketch",
];

export const chipToCategory = (chip) => {
  const map = {
    "All": null,
    "Workshops": "Workshop",
    "Meetups": "Meetup",
    "Hackathons": "Hackathon",
    "Conferences": "Conference",
    "Walks": "Walk",
    "Art & Sketch": "Art & Sketch",
  };
  return map[chip];
};

// R2: orange is never used for a filter — the active chip uses the
// selected/on-selected pair, which is the reserved "this is chosen" treatment.
// R6: chips are min-h-9 with px-4 padding, and gaps sit on the 4px grid.
const CategoryFilter = ({ active, onChange }) => {
  return (
    <div data-testid="category-filter" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {CATEGORIES.map((c) => {
          const isActive = c === active;
          return (
            <button
              key={c}
              data-testid={`chip-${c.toLowerCase().replace(/\s|&/g, '-')}`}
              onClick={() => onChange(c)}
              className={`shrink-0 relative min-h-9 rounded-full px-4 t-button transition-colors duration-fast ease-standard ${
                isActive
                  ? "text-on-selected"
                  : "bg-transparent text-ink-2 hover:bg-raised hover:text-ink"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="categoryActivePill"
                  transition={{ type: "tween", ease: "easeInOut", duration: 0.25 }}
                  className="absolute inset-0 rounded-full bg-selected"
                />
              )}
              <span className="relative z-10">{c}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryFilter;
