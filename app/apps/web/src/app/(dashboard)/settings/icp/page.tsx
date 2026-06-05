"use client";

import { useState, useEffect } from "react";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge, Tag } from "@/components/ui/badge";
import {
  INDUSTRIES,
  COMPANY_SIZES,
  SALES_MOTIONS,
  DECISION_MAKER_ROLES,
  GEOGRAPHIES,
} from "@/lib/config/icp-constants";

export default function IcpSettingsPage() {
  const [productDescription, setProductDescription] = useState("");
  const [salesMotion, setSalesMotion] = useState("");
  const [primaryChallenge, setPrimaryChallenge] = useState("");
  const [aiTone, setAiTone] = useState("");
  const [targetIndustries, setTargetIndustries] = useState<string[]>([]);
  const [targetCompanySizes, setTargetCompanySizes] = useState<string[]>([]);
  const [targetRoles, setTargetRoles] = useState("");
  const [targetGeographies, setTargetGeographies] = useState<string[]>([]);
  // Full Apollo filter surface — parity with the onboarding card.
  const [targetKeywords, setTargetKeywords] = useState<string[]>([]);
  const [targetRevenueMin, setTargetRevenueMin] = useState<number | null>(null);
  const [targetRevenueMax, setTargetRevenueMax] = useState<number | null>(null);
  const [targetTechnologies, setTargetTechnologies] = useState<string[]>([]);
  const [excludeGeographies, setExcludeGeographies] = useState<string[]>([]);
  const [fundingRecencyDays, setFundingRecencyDays] = useState<number | null>(null);
  const [totalFundingMin, setTotalFundingMin] = useState<number | null>(null);
  const [totalFundingMax, setTotalFundingMax] = useState<number | null>(null);
  const [minJobOpenings, setMinJobOpenings] = useState<number | null>(null);
  const [hiringTitles, setHiringTitles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings/icp")
      .then((r) => r.json())
      .then((data) => {
        setProductDescription(data.productDescription || "");
        setSalesMotion(data.salesMotion || "");
        setPrimaryChallenge(data.primaryChallenge || "");
        setAiTone(data.aiTone || "");
        setTargetIndustries(data.targetIndustries || []);
        setTargetCompanySizes(data.targetCompanySizes || []);
        setTargetRoles(data.targetRoles || "");
        setTargetGeographies(data.targetGeographies || []);
        setTargetKeywords(data.targetKeywords || []);
        setTargetRevenueMin(data.targetRevenueMin ?? null);
        setTargetRevenueMax(data.targetRevenueMax ?? null);
        setTargetTechnologies(data.targetTechnologies || []);
        setExcludeGeographies(data.excludeGeographies || []);
        setFundingRecencyDays(data.fundingRecencyDays ?? null);
        setTotalFundingMin(data.totalFundingMin ?? null);
        setTotalFundingMax(data.totalFundingMax ?? null);
        setMinJobOpenings(data.minJobOpenings ?? null);
        setHiringTitles(data.hiringTitles || []);
        setLoaded(true);
      })
      .catch(() => setError("Failed to load ICP settings"));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings/icp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productDescription, salesMotion, primaryChallenge, aiTone,
          targetIndustries, targetCompanySizes, targetRoles, targetGeographies,
          targetKeywords, targetRevenueMin, targetRevenueMax, targetTechnologies,
          excludeGeographies, fundingRecencyDays, totalFundingMin, totalFundingMax,
          minJobOpenings, hiringTitles,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setError("");
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError("Failed to save ICP settings");
      }
    } catch {
      setError("Failed to save ICP settings");
    } finally {
      setSaving(false);
    }
  }

  function toggleArrayItem(arr: string[], item: string, setter: (v: string[]) => void) {
    setter(arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item]);
  }

  if (!loaded) return null;

  return (
    <>
      <h1
        className="text-[24px] font-semibold"
        style={{ color: "var(--color-text-primary)", letterSpacing: "-0.3px" }}
      >
        ICP & Product
      </h1>
      <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-text-tertiary)" }}>
        Define your ideal customer profile and product context. This data drives AI scoring, outbound targeting, and deal coaching.
      </p>

      <div className="mt-8 space-y-8">
        {/* Product context */}
        <section>
          <h2
            className="text-[12px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Product context
          </h2>

          <div className="mt-4 space-y-4">
            <Textarea
              label="Product description"
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              placeholder="Describe what your product does and who it's for..."
              autoResize
            />

            <Select
              label="Sales motion"
              value={salesMotion}
              onChange={(e) => setSalesMotion(e.target.value)}
              options={[
                { value: "", label: "Select..." },
                ...SALES_MOTIONS.map((m) => ({ value: m, label: m })),
              ]}
            />

            <Textarea
              label="Primary challenge"
              value={primaryChallenge}
              onChange={(e) => setPrimaryChallenge(e.target.value)}
              placeholder="What's the main challenge you're solving for customers?"
              autoResize
            />

            <Select
              label="AI tone"
              value={aiTone}
              onChange={(e) => setAiTone(e.target.value)}
              options={[
                { value: "", label: "Select..." },
                { value: "Direct", label: "Direct" },
                { value: "Friendly", label: "Friendly" },
                { value: "Formal", label: "Formal" },
                { value: "Casual", label: "Casual" },
                { value: "Technical", label: "Technical" },
              ]}
            />
          </div>
        </section>

        {/* Target industries */}
        <section>
          <h2
            className="text-[12px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Target industries
          </h2>
          <p className="mt-1 text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
            Select the industries your ideal customers belong to.
          </p>

          {targetIndustries.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {targetIndustries.map((ind) => (
                <Tag key={ind} onRemove={() => toggleArrayItem(targetIndustries, ind, setTargetIndustries)}>
                  {ind}
                </Tag>
              ))}
            </div>
          )}

          <MultiSelectDropdown
            options={INDUSTRIES}
            selected={targetIndustries}
            onToggle={(item) => toggleArrayItem(targetIndustries, item, setTargetIndustries)}
            placeholder="Search industries..."
          />
        </section>

        {/* Target company sizes */}
        <section>
          <h2
            className="text-[12px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Company sizes
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {(COMPANY_SIZES).map((size) => {
              const selected = targetCompanySizes.includes(size);
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => toggleArrayItem(targetCompanySizes, size, setTargetCompanySizes)}
                  className="rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors"
                  style={{
                    background: selected ? "var(--color-accent-soft)" : "var(--color-bg-card)",
                    color: selected ? "var(--color-accent)" : "var(--color-text-secondary)",
                    border: `1px solid ${selected ? "var(--color-accent)" : "var(--color-border-default)"}`,
                  }}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </section>

        {/* Target roles */}
        <section>
          <h2
            className="text-[12px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Decision-maker roles
          </h2>
          <p className="mt-1 text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
            Comma-separated list of roles you want to target.
          </p>

          <div className="mt-3">
            <Textarea
              value={targetRoles}
              onChange={(e) => setTargetRoles(e.target.value)}
              placeholder="CEO, CTO, VP Engineering, Head of Product..."
              autoResize
            />
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            {(DECISION_MAKER_ROLES).slice(0, 20).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => {
                  const current = targetRoles.split(",").map((r) => r.trim()).filter(Boolean);
                  if (!current.includes(role)) {
                    setTargetRoles([...current, role].join(", "));
                  }
                }}
                className="rounded px-2 py-0.5 text-[11px] transition-colors"
                style={{
                  background: "var(--color-bg-card)",
                  color: "var(--color-text-tertiary)",
                  border: "1px solid var(--color-border-default)",
                }}
              >
                + {role}
              </button>
            ))}
          </div>
        </section>

        {/* Target geographies */}
        <section>
          <h2
            className="text-[12px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Geographies
          </h2>

          {targetGeographies.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {targetGeographies.map((geo) => (
                <Tag key={geo} onRemove={() => toggleArrayItem(targetGeographies, geo, setTargetGeographies)}>
                  {geo}
                </Tag>
              ))}
            </div>
          )}

          <MultiSelectDropdown
            options={GEOGRAPHIES}
            selected={targetGeographies}
            onToggle={(item) => toggleArrayItem(targetGeographies, item, setTargetGeographies)}
            placeholder="Search geographies..."
          />
        </section>

        {/* Keywords */}
        <section>
          <h2
            className="text-[12px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Keywords
          </h2>
          <p className="mt-1 text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
            Free-text tags describing the companies you target. Unioned with industries when searching.
          </p>
          <ChipInput
            items={targetKeywords}
            onChange={setTargetKeywords}
            placeholder="Type a keyword and press Enter — e.g. developer tools"
          />
        </section>

        {/* Firmographics */}
        <section>
          <h2
            className="text-[12px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Firmographics
          </h2>

          <div className="mt-4 space-y-4">
            <div>
              <label className="text-[12px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                Annual revenue (USD)
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <AmountField value={targetRevenueMin} onChange={setTargetRevenueMin} placeholder="$ Min" />
                <span className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>to</span>
                <AmountField value={targetRevenueMax} onChange={setTargetRevenueMax} placeholder="$ Max" />
              </div>
            </div>

            <div>
              <label className="text-[12px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                Technologies used
              </label>
              <ChipInput
                items={targetTechnologies}
                onChange={setTargetTechnologies}
                placeholder="Type a technology and press Enter — e.g. Kubernetes"
              />
            </div>

            <div>
              <label className="text-[12px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                Exclude geographies
              </label>
              {excludeGeographies.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {excludeGeographies.map((geo) => (
                    <Tag key={geo} onRemove={() => toggleArrayItem(excludeGeographies, geo, setExcludeGeographies)}>
                      {geo}
                    </Tag>
                  ))}
                </div>
              )}
              <MultiSelectDropdown
                options={GEOGRAPHIES}
                selected={excludeGeographies}
                onToggle={(item) => toggleArrayItem(excludeGeographies, item, setExcludeGeographies)}
                placeholder="Search geographies to exclude..."
              />
            </div>
          </div>
        </section>

        {/* Buying signals */}
        <section>
          <h2
            className="text-[12px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Buying signals
          </h2>

          <div className="mt-4 space-y-4">
            <Select
              label="Recently funded"
              value={fundingRecencyDays === null ? "" : String(fundingRecencyDays)}
              onChange={(e) =>
                setFundingRecencyDays(e.target.value ? Number(e.target.value) : null)
              }
              options={[
                { value: "", label: "Any time" },
                { value: "90", label: "Last 90 days" },
                { value: "180", label: "Last 6 months" },
                { value: "365", label: "Last 12 months" },
              ]}
            />

            <div>
              <label className="text-[12px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                Total funding raised (USD)
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <AmountField value={totalFundingMin} onChange={setTotalFundingMin} placeholder="$ Min" />
                <span className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>to</span>
                <AmountField value={totalFundingMax} onChange={setTotalFundingMax} placeholder="$ Max" />
              </div>
            </div>

            <div>
              <label className="text-[12px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                Min. active job postings
              </label>
              <div className="mt-1.5">
                <AmountField
                  value={minJobOpenings}
                  onChange={setMinJobOpenings}
                  placeholder="e.g. 1 — companies actively hiring"
                />
              </div>
            </div>

            <div>
              <label className="text-[12px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                Hiring for titles
              </label>
              <ChipInput
                items={hiringTitles}
                onChange={setHiringTitles}
                placeholder="Type a title and press Enter — e.g. Account Executive"
              />
            </div>
          </div>
        </section>

        {/* Save */}
        <div className="flex items-center gap-3 pt-2">
          <Button variant="solid" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
          {saved && <Badge variant="success">Saved</Badge>}
          {error && <p className="text-[12px]" style={{ color: "var(--color-error)" }}>{error}</p>}
        </div>
      </div>
    </>
  );
}

/* ── Searchable multi-select dropdown ── */
function MultiSelectDropdown({
  options,
  selected,
  onToggle,
  placeholder,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (item: string) => void;
  placeholder: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = options.filter(
    (o) => o.toLowerCase().includes(search.toLowerCase()) && !selected.includes(o)
  );

  return (
    <div className="relative mt-2">
      <Input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
      />
      {open && search && filtered.length > 0 && (
        <div
          className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md py-1 shadow-lg"
          style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-border-default)",
          }}
        >
          {filtered.slice(0, 20).map((item) => (
            <button
              key={item}
              type="button"
              className="block w-full px-3 py-1.5 text-left text-[13px] transition-colors"
              style={{ color: "var(--color-text-secondary)" }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onToggle(item);
                setSearch("");
                setOpen(false);
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              {item}
            </button>
          ))}
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setSearch(""); }} />
      )}
    </div>
  );
}

/* ── Free-text chip input (no fixed taxonomy) ── */
function ChipInput({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");
  function add(v: string) {
    const t = v.trim();
    if (t && !items.includes(t)) onChange([...items, t]);
    setInput("");
  }
  return (
    <div className="mt-2">
      {items.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <Tag key={item} onRemove={() => onChange(items.filter((x) => x !== item))}>
              {item}
            </Tag>
          ))}
        </div>
      )}
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && input.trim()) {
            e.preventDefault();
            add(input);
          }
        }}
        placeholder={placeholder}
      />
    </div>
  );
}

/** Parse "10k"/"1.5m"/"2b" shorthand + thousands separators → number|null. */
function parseAmount(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/[,$\s]/g, "");
  if (!s) return null;
  const m = s.match(/^(\d*\.?\d+)([kmb])?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const mult = m[2] === "k" ? 1e3 : m[2] === "m" ? 1e6 : m[2] === "b" ? 1e9 : 1;
  return Math.round(n * mult);
}

/* ── Numeric amount field — keeps raw text, emits parsed number ── */
function AmountField({
  value,
  onChange,
  placeholder,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder: string;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  useEffect(() => {
    setText((prev) => (parseAmount(prev) === value ? prev : value === null ? "" : String(value)));
  }, [value]);
  return (
    <Input
      value={text}
      inputMode="numeric"
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseAmount(e.target.value));
      }}
      placeholder={placeholder}
    />
  );
}
