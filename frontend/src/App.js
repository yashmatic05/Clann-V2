import React, { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";

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

const TOAST_OPTIONS = {
  style: {
    background: "#18002C",
    border: "1px solid #46176D",
    color: "#FFFFFF",
  },
};

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
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
        <Route path="*" element={<Home />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={TOAST_OPTIONS}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
