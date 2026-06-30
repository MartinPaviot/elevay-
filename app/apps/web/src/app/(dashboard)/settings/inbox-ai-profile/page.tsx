"use client";

/**
 * Inbox AI data-handling profile (INBOX-P03) settings.
 *
 * Standard / Zero retention / Off, saved owner-scoped (user_preferences JSONB).
 * Inbox AI endpoints gate on this — "Off" disables them fail-closed.
 */

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

type AiProcessingProfile = "standard" | "zero_retention" | "off";
interface AiProfileOption {
  id: AiProcessingProfile;
  label: string;
  description: string;
}

export default function InboxAiProfilePage() {
  const { toast } = useToast();
  const [options, setOptions] = useState<AiProfileOption[]>([]);
  const [profile, setProfile] = useState<AiProcessingProfile>("standard");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const r = await fetch("/api/inbox/ai-profile");
      if (r.ok) {
        const data = (await r.json()) as { options?: AiProfileOption[]; profile?: AiProcessingProfile };
        setOptions(data.options ?? []);
        if (data.profile) setProfile(data.profile);
      } else {
        // Was swallowed: a failure left no profile options (radio list empty),
        // looking like the feature was unavailable.
        setLoadError(true);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const r = await fetch("/api/inbox/ai-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      if (r.ok) {
        const data = (await r.json()) as { profile?: AiProcessingProfile };
        if (data.profile) setProfile(data.profile);
        setSaved(true);
      } else {
        // Was fail-soft (silent): a failed save left the radio on the new value
        // though it never persisted. This gates inbox AI, so it must be visible.
        toast("Couldn't save your AI data-handling profile.", "error");
      }
    } catch {
      toast("Couldn't save your AI data-handling profile.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    // Footprint skeleton reserving the loaded layout (heading + radio-option
    // card rows + Save button) so swapping to real data causes no reflow.
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-40 rounded" />
        </div>
        <Skeleton className="mt-2 h-3 w-64 rounded" />

        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border p-3"
              style={{ borderColor: "var(--color-border-default)", background: "var(--color-bg-card)" }}
            >
              <Skeleton className="mt-0.5 h-4 w-4 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-3.5 w-32 rounded" />
                <Skeleton className="mt-2 h-3 w-3/4 rounded" />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <Skeleton className="h-7 w-16 rounded-md" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div role="alert" className="mx-auto max-w-2xl p-6">
        <h1 className="flex items-center gap-2 text-[16px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
          <ShieldCheck size={16} /> AI data handling
        </h1>
        <p className="mt-2 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
          Couldn&apos;t load your AI data-handling settings. This is not a reset — the request failed.
        </p>
        <Button size="sm" onClick={() => void load()} className="mt-3">Retry</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="flex items-center gap-2 text-[16px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
        <ShieldCheck size={16} /> AI data handling
      </h1>
      <p className="mt-1 text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
        Control how the assistant processes your inbox.
      </p>

      <div className="mt-4 space-y-2">
        {options.map((o) => {
          const selected = profile === o.id;
          return (
            <label
              key={o.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
              style={{
                borderColor: selected ? "var(--color-accent)" : "var(--color-border-default)",
                background: selected ? "var(--color-accent-soft)" : "var(--color-bg-card)",
              }}
            >
              <input
                type="radio"
                name="ai-profile"
                checked={selected}
                onChange={() => {
                  setProfile(o.id);
                  setSaved(false);
                }}
                className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                  {o.label}
                </span>
                <span className="block text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
                  {o.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button size="sm" onClick={() => void save()} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 size={13} className="animate-spin" /> : null}
          {saving ? "Saving…" : "Save"}
        </Button>
        {saved && (
          <span className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
            Saved.
          </span>
        )}
      </div>
    </div>
  );
}
