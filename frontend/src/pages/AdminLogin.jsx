import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ChevronLeft, Lock } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import FormField from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      {/* No Navbar on this page, so the theme switch is pinned to the viewport
          (16px from the top and right edges). Renders nothing while
          ENABLE_LIGHT_MODE is false — see src/lib/theme.js. */}
      <div className="fixed top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <button data-testid="admin-back" onClick={() => navigate("/")} className="t-body text-cta-text hover:underline inline-flex items-center gap-1 mb-6 transition-colors duration-fast ease-standard">
          <ChevronLeft size={16} strokeWidth={1.75}/> Back
        </button>
        <div className="bg-surface border border-line rounded-lg p-8">
          <div className="h-12 w-12 rounded-md bg-raised flex items-center justify-center mb-4">
            <Lock size={24} strokeWidth={1.75} className="text-ink-muted"/>
          </div>
          <h1 className="t-h1 text-ink">Admin Access</h1>
          <p className="mt-1 t-body text-ink-muted">Restricted area. Authorised personnel only.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <FormField label="Email" required>
              <Input data-testid="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </FormField>
            <FormField label="Password" required>
              <Input data-testid="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </FormField>
            <button data-testid="admin-submit" type="submit" disabled={loading} className={cn(buttonVariants({ variant: "primary", size: "md" }), "w-full")}>
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
