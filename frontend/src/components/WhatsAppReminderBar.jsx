import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

// Official WhatsApp glyph (green disc + phone)
const WhatsAppIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="16" cy="16" r="16" fill="#25D366"/>
    <path fill="#FFFFFF" d="M22.7 18.5c-.3-.15-1.86-.9-2.14-1s-.5-.15-.7.15c-.2.3-.8 1-.98 1.2-.18.2-.36.22-.66.07-.3-.15-1.28-.47-2.44-1.5-.9-.8-1.5-1.8-1.68-2.1-.18-.3-.02-.46.13-.6.14-.14.3-.36.45-.55.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.68-1.65-.94-2.26-.24-.6-.5-.52-.68-.53-.18 0-.38 0-.58 0s-.53.07-.8.36c-.28.3-1.05 1.02-1.05 2.5s1.08 2.9 1.23 3.1c.15.2 2.12 3.25 5.15 4.44.72.3 1.28.48 1.72.62.72.23 1.38.2 1.9.12.58-.08 1.86-.76 2.12-1.5.27-.72.27-1.34.18-1.5-.08-.15-.28-.23-.58-.38z"/>
    <path fill="#FFFFFF" d="M16.02 6.4c-5.32 0-9.63 4.3-9.63 9.6 0 1.7.44 3.36 1.28 4.82L6.5 25.6l4.9-1.28a9.6 9.6 0 0 0 4.62 1.18h.02c5.3 0 9.62-4.32 9.62-9.62 0-2.57-1-4.98-2.82-6.8a9.55 9.55 0 0 0-6.82-2.8zm0 17.6h-.02a7.98 7.98 0 0 1-4.06-1.12l-.3-.17-3.06.8.82-2.98-.2-.3a8 8 0 1 1 6.82 3.77z" opacity=".85"/>
  </svg>
);

const WhatsAppReminderBar = ({ testid = "whatsapp-reminder-bar" }) => {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const enabled = !!user?.whatsapp_reminder_enabled;
  const [busy, setBusy] = useState(false);

  const onToggle = async (v) => {
    if (!user) {
      toast.error("Sign up to enable reminders");
      navigate("/auth");
      return;
    }
    setBusy(true);
    try {
      await api.post("/auth/whatsapp-toggle", { enabled: v });
      setUser({ ...user, whatsapp_reminder_enabled: v });
      toast.success(v ? "WhatsApp reminders on" : "WhatsApp reminders off");
    } catch { toast.error("Could not update"); }
    setBusy(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6" data-testid={testid}>
      <div className="bg-[#18002C] border border-[#46176D]/30 rounded-2xl px-4 sm:px-6 py-4 flex items-center gap-4">
        <WhatsAppIcon size={30} />
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-base sm:text-lg leading-tight">Enable WhatsApp Reminders</p>
          <p className="text-[11px] sm:text-xs text-[#727272] mt-1">Never miss an update.</p>
        </div>
        <Switch
          data-testid={`${testid}-switch`}
          checked={enabled}
          disabled={busy}
          onCheckedChange={onToggle}
          className="data-[state=checked]:bg-[#F84E00]"
        />
      </div>
    </div>
  );
};

export default WhatsAppReminderBar;
