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
    <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#280049] border-t-[#F84E00] rounded-full animate-spin mx-auto"></div>
        <p className="mt-4 text-sm text-[#BF72FF] uppercase tracking-widest font-bold" data-testid="auth-callback-msg">{msg}</p>
      </div>
    </div>
  );
};

export default AuthCallback;
