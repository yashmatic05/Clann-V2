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
      {/* R1/R5: flat surface + border, no translucent panel, no shadow in a card-like bar. */}
      <div className="bg-surface border border-line rounded-lg px-4 sm:px-6 py-4 flex items-center gap-4">
        <WhatsAppIcon size={32} />
        <div className="flex-1 min-w-0">
          <p className="t-h3 text-ink">Enable WhatsApp Reminders</p>
          <p className="t-caption text-ink-muted mt-1">Never miss an update.</p>
        </div>
        {/* R2: orange is never used for a control's on-state — Switch already
            paints bg-selected when checked, so no override is passed here. */}
        <Switch
          data-testid={`${testid}-switch`}
          checked={enabled}
          disabled={busy}
          onCheckedChange={onToggle}
        />
      </div>
    </div>
  );
};

export default WhatsAppReminderBar;
