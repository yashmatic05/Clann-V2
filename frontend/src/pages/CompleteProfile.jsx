import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import ThemeToggle from "@/components/ThemeToggle";
import { PartyPopper } from "lucide-react";
import FormField from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CITIES = ["Delhi", "Mumbai", "Bangalore", "Pune", "Other"];
const EVENT_TYPES = ["Workshops", "Meetups", "Hackathons", "Conferences", "Walks", "Art & Sketch"];

const CompleteProfile = () => {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [role, setRole] = useState("attendee");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Delhi");
  const [orgName, setOrgName] = useState("");
  const [instagram, setInstagram] = useState("");
  const [types, setTypes] = useState([]);
  const [whatsappOn, setWhatsappOn] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  if (!user) { navigate("/auth"); return null; }

  const toggleType = (t) => setTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);

  const submit = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) { toast.error("Please enter a valid mobile number"); return; }
    if (role === "organizer" && !orgName.trim()) { toast.error("Organisation name required"); return; }
    const fullPhone = `+91 ${digits.slice(-10)}`;
    try {
      await api.post("/auth/complete-profile", {
        phone: fullPhone, city, role,
        org_name: orgName, event_types: types, instagram,
        whatsapp_reminder_enabled: whatsappOn,
      });
      setUser({ ...user, profile_complete: true, role, city, phone: fullPhone, whatsapp_reminder_enabled: whatsappOn });
      setSubmitted(true);
      if (role === "attendee") setTimeout(() => navigate("/"), 1400);
    } catch { toast.error("Could not save profile"); }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
        {/* No Navbar on this page, so the theme switch is pinned to the viewport
            (16px from the top and right edges). Renders nothing while
            ENABLE_LIGHT_MODE is false — see src/lib/theme.js. */}
        <div className="fixed top-4 right-4 z-20">
          <ThemeToggle />
        </div>
        <div className="max-w-md w-full text-center bg-surface rounded-lg p-8 border border-line">
          {/* R7 bans emoji in interface chrome, so the celebration glyph becomes
              the equivalent lucide line icon. The words around it are unchanged. */}
          <PartyPopper size={32} strokeWidth={1.75} className="mx-auto mb-3 text-ok" aria-hidden="true" />
          <h1 data-testid="signup-success" className="t-h1 text-ink">Welcome to Clann!</h1>
          <p className="mt-2 t-body text-ink-muted">
            {role === "organizer"
              ? "Your account has been created. Our team will review your organizer profile and get in touch shortly."
              : "Your account has been created. Discover events near you."}
          </p>
          <button data-testid="go-home" onClick={() => navigate("/")} className={cn(buttonVariants({ variant: "primary", size: "md" }), "mt-6")}>
            Explore Events
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas py-12 px-4">
      {/* No Navbar on this page, so the theme switch is pinned to the viewport
          (16px from the top and right edges). Renders nothing while
          ENABLE_LIGHT_MODE is false — see src/lib/theme.js. */}
      <div className="fixed top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      <div className="max-w-md mx-auto bg-surface rounded-lg p-6 border border-line">
        <h1 className="t-h1 text-ink">Complete Your Profile</h1>
        <p className="mt-1 t-body text-ink-muted">Just a few more details so we can personalize your feed.</p>

        <div className="mt-6 space-y-4">
          <div>
            <span className="t-label text-ink-2 block mb-2">I am a</span>
            <div className="grid grid-cols-2 gap-2">
              {["attendee", "organizer"].map((r) => (
                <button
                  key={r}
                  data-testid={`role-${r}`}
                  onClick={() => setRole(r)}
                  aria-pressed={role === r}
                  className={cn(
                    "inline-flex min-h-11 items-center justify-center rounded-full border px-4 t-label font-bold uppercase tracking-wider transition-colors duration-fast ease-standard",
                    role === r
                      ? "border-selected bg-selected text-on-selected"
                      : "border-line bg-raised text-ink-2 hover:border-line-input hover:text-ink"
                  )}
                >{r}</button>
              ))}
            </div>
          </div>

          <FormField label="Mobile Number" required>
            <div className="flex items-stretch bg-surface border border-line-input hover:border-ink-2 focus-within:border-ink rounded-md overflow-hidden transition-colors duration-fast ease-standard">
              <span className="px-3 flex items-center bg-raised text-ink-2 t-body-strong border-r border-line-input">+91</span>
              <input
                data-testid="profile-phone"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="98765 43210"
                className="h-11 flex-1 bg-transparent px-4 text-base md:text-sm text-ink placeholder:text-ink-muted"
              />
            </div>
          </FormField>

          <div className="bg-canvas rounded-lg border border-line p-4">
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="profile-whatsapp" className="t-body-strong text-ink flex-1">Enable WhatsApp reminders for events I save or register for</label>
              <Switch
                id="profile-whatsapp"
                data-testid="profile-whatsapp"
                checked={whatsappOn}
                onCheckedChange={setWhatsappOn}
              />
            </div>
            <p className="mt-2 t-caption text-ink-muted">We'll send you a reminder 24 hours before your saved events. You can turn this off anytime.</p>
          </div>

          <FormField label="City">
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger data-testid="profile-city">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>

          {role === "organizer" && (
            <>
              <FormField label="Organisation Name">
                <Input data-testid="profile-org" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </FormField>
              <div>
                <span className="t-label text-ink-2 block mb-2">Type of Events You Organize</span>
                <div className="flex flex-wrap gap-2">
                  {EVENT_TYPES.map((t) => (
                    <button
                      key={t}
                      data-testid={`type-${t.toLowerCase().replace(/\s|&/g, '-')}`}
                      onClick={() => toggleType(t)}
                      aria-pressed={types.includes(t)}
                      className={cn(
                        "inline-flex min-h-9 items-center justify-center rounded-full border px-3 t-caption font-bold uppercase tracking-wider transition-colors duration-fast ease-standard",
                        types.includes(t)
                          ? "border-selected bg-selected text-on-selected"
                          : "border-line bg-raised text-ink-2 hover:border-line-input hover:text-ink"
                      )}
                    >{t}</button>
                  ))}
                </div>
              </div>
              <FormField label="Instagram (optional)">
                <Input data-testid="profile-instagram" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@yourhandle" />
              </FormField>
            </>
          )}

          <button data-testid="profile-submit" onClick={submit} className={cn(buttonVariants({ variant: "primary", size: "md" }), "w-full")}>
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompleteProfile;
