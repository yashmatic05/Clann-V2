import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ChevronLeft, Lock } from "lucide-react";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/admin/login", { email, password });
      localStorage.setItem("clann_admin_token", data.token);
      localStorage.setItem("clann_admin_email", data.email);
      toast.success("Admin authenticated");
      navigate("/admin");
    } catch {
      toast.error("Invalid credentials");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <button data-testid="admin-back" onClick={() => navigate("/")} className="text-[#BF72FF] hover:text-white text-sm inline-flex items-center gap-1 mb-6 transition-colors">
          <ChevronLeft size={16}/> Back
        </button>
        <div className="bg-[#18002C] border border-[#46176D]/30 rounded-2xl p-8">
          <div className="w-12 h-12 rounded-xl bg-[#F84E00] flex items-center justify-center mb-4">
            <Lock size={20} className="text-white"/>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Admin Access</h1>
          <p className="mt-1 text-sm text-[#727272]">Restricted area. Authorised personnel only.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#BF72FF]">Email</label>
              <input data-testid="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-2 w-full bg-[#0D0D0D] border border-[#46176D]/40 focus:border-[#F84E00] rounded-lg px-4 py-2.5 text-sm text-white outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[#BF72FF]">Password</label>
              <input data-testid="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-2 w-full bg-[#0D0D0D] border border-[#46176D]/40 focus:border-[#F84E00] rounded-lg px-4 py-2.5 text-sm text-white outline-none" />
            </div>
            <button data-testid="admin-submit" type="submit" disabled={loading} className="w-full bg-[#F84E00] hover:bg-[#D14200] active:bg-[#C63E00] disabled:opacity-60 text-white rounded-full px-5 py-3 font-bold text-sm transition-colors">
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
