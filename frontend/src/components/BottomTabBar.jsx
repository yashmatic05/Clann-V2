import React from "react";
import { Home, Search, Calendar } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const tabs = [
  { to: "/", label: "Home", icon: Home, testid: "tab-home" },
  { to: "/search", label: "Search", icon: Search, testid: "tab-search" },
  { to: "/calendar", label: "Calendar", icon: Calendar, testid: "tab-calendar" },
];

const BottomTabBar = () => {
  const { pathname } = useLocation();
  return (
    <nav
      data-testid="bottom-tab-bar"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#18002C]/95 backdrop-blur-lg border-t border-[#46176D]/50"
    >
      <ul className="grid grid-cols-3 px-2 py-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = pathname === t.to;
          return (
            <li key={t.label}>
              <Link
                to={t.to}
                data-testid={t.testid}
                className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-lg transition-colors ${
                  active ? "text-[#F84E00]" : "text-[#727272] hover:text-white"
                }`}
              >
                <Icon size={18} />
                <span className="text-[10px] font-semibold leading-none">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default BottomTabBar;
