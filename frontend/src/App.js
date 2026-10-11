import React, { useEffect, useMemo } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import {
  THEME_STORAGE_KEY,
  DEFAULT_THEME,
  THEME_COLOR_META,
  resolveForcedTheme,
} from "@/lib/theme";

import Home from "@/pages/Home";
import EventDetail from "@/pages/EventDetail";
import Auth from "@/pages/Auth";
import AuthCallback from "@/pages/AuthCallback";
import CompleteProfile from "@/pages/CompleteProfile";
import AdminLogin from "@/pages/AdminLogin";
import AdminPanel from "@/pages/AdminPanel";
import Saved from "@/pages/Saved";
import Profile from "@/pages/Profile";
import CalendarPage from "@/pages/CalendarPage";
import Search from "@/pages/Search";
import EventsListPage from "@/pages/EventsListPage";
import OrganizerSubmit from "@/pages/OrganizerSubmit";
import DesignSystem from "@/pages/DesignSystem";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

/**
 * Keeps <meta name="theme-color"> in step with the active theme so mobile
 * browser chrome matches the canvas token (cream in light, near-black in dark).
 * The meta tag cannot resolve a CSS custom property, hence the literal pair in
 * THEME_COLOR_META — the only sanctioned hex values in src/.
 */
function ThemeColorMeta() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute(
      "content",
      resolvedTheme === "light" ? THEME_COLOR_META.light : THEME_COLOR_META.dark
    );
  }, [resolvedTheme]);

  return null;
}

// Intercepts OAuth callback (session_id in URL hash) before normal routing
function AppRouter() {
  const location = useLocation();
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  if (location.hash?.includes("session_id=")) return <AuthCallback />;

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/event/:id" element={<EventDetail />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/search" element={<Search />} />
        <Route path="/events" element={<EventsListPage />} />
        <Route path="/organizer" element={<OrganizerSubmit />} />
        <Route path="/admin-clann-secret" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminPanel />} />
        {/* Design-system style guide (DESIGN_SYSTEM.md). Not linked from
            anywhere in the product; visit /design-system directly. */}
        <Route path="/design-system" element={<DesignSystem />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </>
  );
}

function App() {
  // undefined unless ?previewTheme= is present, in which case that theme is
  // forced for this tab only. With ENABLE_LIGHT_MODE on (Part 5) the visitor's
  // explicit choice decides, else their system preference via enableSystem
  // above. See src/lib/theme.js.
  const forcedTheme = useMemo(() => resolveForcedTheme(), []);

  return (
    <ThemeProvider
      attribute="class"
      storageKey={THEME_STORAGE_KEY}
      defaultTheme={DEFAULT_THEME}
      enableSystem
      disableTransitionOnChange
      forcedTheme={forcedTheme}
    >
      <ThemeColorMeta />
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
          <Toaster position="top-center" />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
