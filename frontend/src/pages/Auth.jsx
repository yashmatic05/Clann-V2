import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import Footer from "@/components/Footer";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const startGoogleAuth = () => {
  const redirectUrl = `${window.location.origin}/`;
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
};

const Auth = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState("signup");

  return (
    <div className="min-h-screen bg-[#0D0D0D] flex flex-col items-center px-4 py-10">
      <button data-testid="auth-back" onClick={() => navigate("/")} className="self-start max-w-md w-full text-[#BF72FF] hover:text-white text-sm inline-flex items-center gap-1 transition-colors">
        <ChevronLeft size={16}/> Back to home
      </button>

      <Link to="/" className="mt-6 mb-6 flex items-center justify-center" data-testid="auth-brand">
        <img src="/brand/clann-logo.png" alt="Clann" className="h-10 w-auto" />
      </Link>
      <p className="text-sm text-[#BF72FF] font-bold tracking-widest uppercase mb-6">Explore More. Upskill More.</p>

      <div className="w-full max-w-md bg-[#18002C] border border-[#46176D]/30 rounded-2xl p-6">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid grid-cols-2 bg-[#280049] rounded-full p-1 mb-6 h-auto">
            <TabsTrigger data-testid="tab-signup" value="signup" className="rounded-full data-[state=active]:bg-[#F84E00] data-[state=active]:text-white text-[#BF72FF] font-bold text-sm py-3">Sign Up</TabsTrigger>
            <TabsTrigger data-testid="tab-login" value="login" className="rounded-full data-[state=active]:bg-[#F84E00] data-[state=active]:text-white text-[#BF72FF] font-bold text-sm py-3">Login</TabsTrigger>
          </TabsList>

          <TabsContent value="signup" className="space-y-4">
            <h2 className="text-2xl font-black text-white tracking-tight">Join Clann</h2>
            <p className="text-sm text-[#727272]">Sign up in seconds using Google. You'll add your details next.</p>
            <button
              onClick={startGoogleAuth}
              data-testid="google-signup-btn"
              className="w-full bg-white hover:bg-[#FFFBE9] active:bg-white/90 text-[#0D0D0D] rounded-full px-5 py-3 font-bold text-sm inline-flex items-center justify-center gap-3 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.2 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Continue with Google
            </button>
            <p className="text-[10px] text-[#727272] text-center pt-2">
              By continuing you agree to Clann's community guidelines.
            </p>
          </TabsContent>

          <TabsContent value="login" className="space-y-4">
            <h2 className="text-2xl font-black text-white tracking-tight">Welcome Back</h2>
            <p className="text-sm text-[#727272]">Sign in with the same Google account you used to sign up.</p>
            <button
              onClick={startGoogleAuth}
              data-testid="google-login-btn"
              className="w-full bg-white hover:bg-[#FFFBE9] text-[#0D0D0D] rounded-full px-5 py-3 font-bold text-sm inline-flex items-center justify-center gap-3 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.2 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Continue with Google
            </button>
          </TabsContent>
        </Tabs>
      </div>

      <p className="mt-8 text-xs text-[#727272]">Are you the admin? <Link to="/admin-clann-secret" className="text-[#BF72FF] hover:text-white transition-colors" data-testid="admin-hint-link">Admin login →</Link></p>

      <div className="w-full self-stretch">
        <Footer />
      </div>
    </div>
  );
};

export default Auth;
