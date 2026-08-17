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

const CategoryFilter = ({ active, onChange }) => {
  return (
    <div data-testid="category-filter" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {CATEGORIES.map((c) => {
          const isActive = c === active;
          return (
            <button
              key={c}
              data-testid={`chip-${c.toLowerCase().replace(/\s|&/g, '-')}`}
              onClick={() => onChange(c)}
              className={`shrink-0 relative rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? "text-white"
                  : "bg-transparent text-[#BF72FF]/80 hover:text-white hover:bg-[#280049]/60"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="categoryActivePill"
                  transition={{ type: "tween", ease: "easeInOut", duration: 0.25 }}
                  className="absolute inset-0 rounded-full bg-[#F84E00]"
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
