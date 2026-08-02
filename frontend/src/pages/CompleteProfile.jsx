import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

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
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center bg-[#18002C] rounded-2xl p-8 border border-[#46176D]/30">
          <div className="text-4xl mb-3">🎉</div>
          <h1 data-testid="signup-success" className="text-2xl font-black text-white tracking-tight">Welcome to Clann!</h1>
          <p className="mt-2 text-sm text-[#727272]">
            {role === "organizer"
              ? "Your account has been created. Our team will review your organizer profile and get in touch shortly."
              : "Your account has been created. Discover events near you."}
          </p>
          <button data-testid="go-home" onClick={() => navigate("/")} className="mt-6 bg-[#F84E00] hover:bg-[#D14200] text-white rounded-full px-6 py-3 font-bold text-sm transition-colors">
            Explore Events
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] py-10 px-4">
      <div className="max-w-md mx-auto bg-[#18002C] rounded-2xl p-6 border border-[#46176D]/30">
        <h1 className="text-2xl font-black text-white tracking-tight">Complete Your Profile</h1>
        <p className="mt-1 text-sm text-[#727272]">Just a few more details so we can personalize your feed.</p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-[#BF72FF]">I am a</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {["attendee", "organizer"].map((r) => (
                <button key={r} data-testid={`role-${r}`} onClick={() => setRole(r)} className={`rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wider border transition-colors ${role === r ? "bg-[#F84E00] text-white border-[#F84E00]" : "bg-[#280049] text-[#BF72FF] border-transparent hover:border-[#46176D]"}`}>{r}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-[#BF72FF]">Mobile Number *</label>
            <div className="mt-2 flex items-stretch bg-[#0D0D0D] border border-[#46176D]/40 focus-within:border-[#F84E00] rounded-lg overflow-hidden transition-colors">
              <span className="px-3 flex items-center bg-[#280049] text-[#BF72FF] text-sm font-bold border-r border-[#46176D]/40">+91</span>
              <input
                data-testid="profile-phone"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="98765 43210"
                className="flex-1 bg-transparent px-4 py-2.5 text-sm text-white placeholder-[#727272] outline-none"
              />
            </div>
          </div>

          <div className="bg-[#0D0D0D] rounded-lg border border-[#46176D]/40 p-4">
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm text-white font-medium flex-1">Enable WhatsApp reminders for events I save or register for</label>
              <Switch
                data-testid="profile-whatsapp"
                checked={whatsappOn}
                onCheckedChange={setWhatsappOn}
                className="data-[state=checked]:bg-[#F84E00]"
              />
            </div>
            <p className="mt-2 text-[11px] text-[#727272]">We'll send you a reminder 24 hours before your saved events. You can turn this off anytime.</p>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-[#BF72FF]">City</label>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger data-testid="profile-city" className="mt-2 bg-[#0D0D0D] border-[#46176D]/40 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#18002C] border-[#46176D] text-white">
                {CITIES.map((c) => <SelectItem key={c} value={c} className="focus:bg-[#280049] focus:text-white">{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {role === "organizer" && (
            <>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#BF72FF]">Organisation Name</label>
                <input data-testid="profile-org" value={orgName} onChange={(e) => setOrgName(e.target.value)} className="mt-2 w-full bg-[#0D0D0D] border border-[#46176D]/40 focus:border-[#F84E00] rounded-lg px-4 py-2.5 text-sm text-white outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#BF72FF]">Type of Events You Organize</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {EVENT_TYPES.map((t) => (
                    <button key={t} data-testid={`type-${t.toLowerCase().replace(/\s|&/g, '-')}`} onClick={() => toggleType(t)} className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider border transition-colors ${types.includes(t) ? "bg-[#F84E00] text-white border-[#F84E00]" : "bg-[#280049] text-[#BF72FF] border-transparent hover:border-[#46176D]"}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-[#BF72FF]">Instagram (optional)</label>
                <input data-testid="profile-instagram" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@yourhandle" className="mt-2 w-full bg-[#0D0D0D] border border-[#46176D]/40 focus:border-[#F84E00] rounded-lg px-4 py-2.5 text-sm text-white outline-none" />
              </div>
            </>
          )}

          <button data-testid="profile-submit" onClick={submit} className="w-full bg-[#F84E00] hover:bg-[#D14200] text-white rounded-full px-5 py-3 font-bold text-sm transition-colors">
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompleteProfile;
