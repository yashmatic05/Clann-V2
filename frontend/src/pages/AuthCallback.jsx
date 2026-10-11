import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);
  const [msg, setMsg] = useState("Setting up your account...");

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    const hash = window.location.hash || "";
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) { navigate("/"); return; }
    const session_id = match[1];
    (async () => {
      try {
        const { data } = await api.post("/auth/session", { session_id });
        setUser(data);
        toast.success(`Welcome ${data.name?.split(" ")[0] || ""}!`);
        window.history.replaceState({}, "", "/");
        if (!data.profile_complete) navigate("/complete-profile", { state: { user: data }, replace: true });
        else navigate("/", { replace: true });
      } catch (e) {
        setMsg("Authentication failed. Redirecting...");
        setTimeout(() => navigate("/auth"), 1200);
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center">
      <div className="text-center">
        <div className="h-12 w-12 rounded-full border-4 border-line border-t-cta animate-spin mx-auto"></div>
        <p className="mt-4 t-body-strong text-ink-2" data-testid="auth-callback-msg">{msg}</p>
      </div>
    </div>
  );
};

export default AuthCallback;
