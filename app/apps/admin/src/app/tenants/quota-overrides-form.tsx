"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import {
  updateQuotaOverrides,
  type QuotaOverrides,
  type LimitKey,
} from "./actions";
import type { TierLimits } from "@web/lib/pricing/tiers";

type FieldState = { inherit: boolean; value: string };

const FIELD_ORDER: { key: LimitKey; label: string; hint: string }[] = [
  { key: "contacts", label: "Contacts", hint: "Total contact rows the tenant may own." },
  { key: "emailsPerMonth", label: "Emails / period", hint: "Metered per billing period." },
  { key: "aiQueriesPerMonth", label: "AI queries / period", hint: "Metered per billing period." },
];

function initialField(override: number | null | undefined): FieldState {
  if (override === null || override === undefined) return { inherit: true, value: "" };
  return { inherit: false, value: String(override) };
}

interface Props {
  tenantId: string;
  tenantName: string;
  planLabel: string;
  planLimits: TierLimits;
  initialOverrides: QuotaOverrides;
  onSaved?: () => void;
}

export function QuotaOverridesForm({
  tenantId,
  tenantName,
  planLabel,
  planLimits,
  initialOverrides,
  onSaved,
}: Props) {
  const [fields, setFields] = useState<Record<LimitKey, FieldState>>({
    contacts: initialField(initialOverrides.contacts),
    emailsPerMonth: initialField(initialOverrides.emailsPerMonth),
    aiQueriesPerMonth: initialField(initialOverrides.aiQueriesPerMonth),
  });
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function update<K extends LimitKey>(key: K, patch: Partial<FieldState>) {
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    setResult(null);
  }

  function save() {
    const overrides: QuotaOverrides = {};
    for (const { key } of FIELD_ORDER) {
      const f = fields[key];
      if (f.inherit) {
        overrides[key] = null;
        continue;
      }
      const n = Number(f.value);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        setResult({ ok: false, error: `${key}: must be a non-negative integer` });
        return;
      }
      overrides[key] = n;
    }
    startTransition(async () => {
      const r = await updateQuotaOverrides({ tenantId, overrides });
      setResult(r);
      if (r.ok) onSaved?.();
    });
  }

  function formatPlanDefault(n: number): string {
    if (!Number.isFinite(n)) return "unlimited";
    return n.toLocaleString();
  }

  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: "var(--color-border-default)", background: "var(--color-bg-card)" }}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <div className="text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {tenantName}
          </div>
          <div className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
            {tenantId} · plan <strong>{planLabel}</strong>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {FIELD_ORDER.map(({ key, label, hint }) => {
          const f = fields[key];
          const planDefault = planLimits[key];
          return (
            <div key={key} className="grid grid-cols-[160px_1fr_auto] items-start gap-3">
              <div>
                <div className="text-[12px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                  {label}
                </div>
                <div className="text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>
                  plan default: {formatPlanDefault(planDefault)}
                </div>
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                  <input
                    type="checkbox"
                    checked={f.inherit}
                    onChange={(e) => update(key, { inherit: e.target.checked })}
                  />
                  Inherit plan default
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  disabled={f.inherit || pending}
                  value={f.value}
                  onChange={(e) => update(key, { value: e.target.value })}
                  placeholder={f.inherit ? "inherit" : "0 = hard block"}
                  className="w-full rounded-md border px-2 py-1 text-[12px]"
                  style={{
                    borderColor: "var(--color-border-default)",
                    background: f.inherit ? "var(--color-bg-muted)" : "var(--color-bg-input)",
                    color: "var(--color-text-primary)",
                  }}
                />
                <div className="mt-0.5 text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>
                  {hint}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium"
          style={{ background: "var(--color-accent)", color: "white", opacity: pending ? 0.6 : 1 }}
        >
          {pending ? "Saving…" : "Save overrides"}
        </button>
        {result?.ok && (
          <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: "#10b981" }}>
            <Check size={13} /> Saved
          </span>
        )}
        {result && !result.ok && (
          <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: "#ef4444" }}>
            <X size={13} /> {result.error || "Save failed"}
          </span>
        )}
      </div>

      <div className="mt-3 border-t pt-3 text-[10px]" style={{ borderColor: "var(--color-border-default)", color: "var(--color-text-tertiary)" }}>
        Inherit = plan default applies. 0 = hard block (legitimate way to pause a tenant
        without deleting data). Fractional or negative values are rejected.
      </div>
    </div>
  );
}
