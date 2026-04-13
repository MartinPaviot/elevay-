"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Video } from "lucide-react";
import { useSafeFetch } from "@/lib/use-safe-fetch";

export default function RecordingSettingsPage() {
  const [enabled, setEnabled] = useState(false);
  const [botName, setBotName] = useState("Elevay Notetaker");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const sfetch = useSafeFetch();

  useEffect(() => {
    sfetch<{ settings?: { recordingEnabled?: boolean; recordingBotName?: string } }>(
      "/api/settings/workspace",
      { errorMessage: "Failed to load recording settings" },
    ).then(({ data }) => {
      if (data?.settings) {
        setEnabled(data.settings.recordingEnabled || false);
        setBotName(data.settings.recordingBotName || "Elevay Notetaker");
      }
    });
  }, [sfetch]);

  async function handleSave() {
    setSaving(true);
    const { error } = await sfetch("/api/settings/workspace", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recordingEnabled: enabled,
        recordingBotName: botName.trim(),
      }),
      errorMessage: "Failed to save recording settings",
    });
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  return (
    <>
      <h1 className="text-[24px] font-bold" style={{ color: "var(--color-text-primary)", letterSpacing: "-0.3px" }}>
        Recording
      </h1>
      <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-text-tertiary)" }}>
        Configure automatic meeting recording and transcription.
      </p>

      <div className="mt-8 space-y-6">
        {/* Toggle */}
        <div className="flex items-center justify-between rounded-lg p-4" style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border-default)" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "var(--color-bg-hover)" }}>
              <Video size={16} style={{ color: "var(--color-text-secondary)" }} />
            </div>
            <div>
              <p className="text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                Auto-record meetings
              </p>
              <p className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
                A bot joins your meetings to record and transcribe automatically.
              </p>
            </div>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            className="relative h-6 w-11 rounded-full transition-colors"
            style={{ background: enabled ? "var(--color-accent)" : "var(--color-bg-emphasis)" }}
          >
            <span
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
              style={{ left: enabled ? 22 : 2 }}
            />
          </button>
        </div>

        {/* Bot name */}
        <div>
          <Input
            label="Bot display name"
            value={botName}
            onChange={(e) => setBotName(e.target.value)}
            placeholder="Elevay Notetaker"
          />
          <p className="mt-1 text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
            This name appears when the bot joins your meetings.
          </p>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3">
          <Button variant="solid" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
          {saved && <Badge variant="success">Saved</Badge>}
        </div>
      </div>
    </>
  );
}
