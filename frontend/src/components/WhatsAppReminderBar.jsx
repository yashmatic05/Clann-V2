import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import WhatsAppIcon from "@/components/WhatsAppIcon";

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
