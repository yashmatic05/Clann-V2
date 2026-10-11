import React from "react";
import { Home, Search, Calendar } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const tabs = [
  { to: "/", label: "Home", icon: Home, testid: "tab-home" },
  { to: "/search", label: "Search", icon: Search, testid: "tab-search" },
  { to: "/calendar", label: "Calendar", icon: Calendar, testid: "tab-calendar" },
];

// R2: orange is never used for a tab bar — the active tab uses the
// selected/on-selected pair. R1: flat surface + a border, no glassmorphism.
// R6: each Link is a 44px tap target and the bar totals 52px, so pages can
// clear it with pb-16 (64px) — the largest value on the R6 spacing scale.
const BottomTabBar = () => {
  const { pathname } = useLocation();
  return (
    <nav
      data-testid="bottom-tab-bar"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface"
    >
      <ul className="grid grid-cols-3 px-2 py-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = pathname === t.to;
          return (
            <li key={t.label}>
              <Link
                to={t.to}
                data-testid={t.testid}
                className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg px-2 py-1 transition-colors duration-fast ease-standard ${
                  active
                    ? "bg-selected text-on-selected"
                    : "text-ink-muted hover:bg-raised hover:text-ink"
                }`}
              >
                <Icon size={16} strokeWidth={1.75} />
                <span className="t-caption font-semibold">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default BottomTabBar;
