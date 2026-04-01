"use client";

import { useState, useEffect } from "react";
import { Plus, X, ChevronDown } from "lucide-react";

const ENTITY_TYPES = ["company", "contact", "deal"] as const;
type EntityType = typeof ENTITY_TYPES[number];

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "date", label: "Date" },
  { value: "number", label: "Number" },
  { value: "single_select", label: "Single Select" },
  { value: "multi_select", label: "Multi Select" },
  { value: "url", label: "URL" },
  { value: "social_handle", label: "Social Handle" },
  { value: "address", label: "Address" },
  { value: "markdown", label: "Markdown" },
] as const;

const AI_FILL_MODES = [
  { value: "off", label: "Off" },
  { value: "suggest", label: "Suggest" },
  { value: "auto", label: "Auto" },
] as const;

interface CustomField {
  id: string;
  name: string;
  type: string;
  entityType: EntityType;
  aiFillMode: string;
  options?: string[];
  required: boolean;
}

export default function DataModelPage() {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeEntity, setActiveEntity] = useState<EntityType>("company");
  const [showAdd, setShowAdd] = useState(false);
  const [newField, setNewField] = useState({ name: "", type: "text", aiFillMode: "off", options: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings/data-model")
      .then((r) => r.ok ? r.json() : { fields: [] })
      .then((data) => setFields(data.fields || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const entityFields = fields.filter((f) => f.entityType === activeEntity);

  async function addField() {
    if (!newField.name.trim()) return;
    setSaving(true);
    const field: CustomField = {
      id: crypto.randomUUID(),
      name: newField.name.trim(),
      type: newField.type,
      entityType: activeEntity,
      aiFillMode: newField.aiFillMode,
      options: newField.type.includes("select") ? newField.options.split(",").map((o) => o.trim()).filter(Boolean) : undefined,
      required: false,
    };
    const updated = [...fields, field];
    setFields(updated);
    setNewField({ name: "", type: "text", aiFillMode: "off", options: "" });
    setShowAdd(false);
    await saveFields(updated);
    setSaving(false);
  }

  async function removeField(id: string) {
    const updated = fields.filter((f) => f.id !== id);
    setFields(updated);
    await saveFields(updated);
  }

  async function updateFieldAiMode(id: string, mode: string) {
    const updated = fields.map((f) => f.id === id ? { ...f, aiFillMode: mode } : f);
    setFields(updated);
    await saveFields(updated);
  }

  async function saveFields(fieldsToSave: CustomField[]) {
    try {
      await fetch("/api/settings/data-model", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: fieldsToSave }),
      });
    } catch {
      console.error("Failed to save fields");
    }
  }

  return (
    <>
      <h1 className="text-[24px] font-semibold" style={{ color: "var(--color-text-primary)", letterSpacing: "-0.3px" }}>
        Data Model
      </h1>
      <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-text-tertiary)" }}>
        Customize fields for each entity type. The AI reads field descriptions to fill data automatically.
      </p>

      {/* Entity type tabs */}
      <div className="mt-6 flex gap-1">
        {ENTITY_TYPES.map((entity) => (
          <button key={entity} onClick={() => setActiveEntity(entity)}
            className="rounded-md px-3 py-1.5 text-[12px] font-medium capitalize transition-colors"
            style={{
              background: activeEntity === entity ? "var(--color-accent-soft)" : "transparent",
              color: activeEntity === entity ? "var(--color-accent)" : "var(--color-text-tertiary)",
            }}>
            {entity === "company" ? "Companies" : entity === "contact" ? "Contacts" : "Deals"}
          </button>
        ))}
      </div>

      {/* Built-in fields */}
      <div className="mt-4">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
          Built-in fields
        </div>
        <div className="space-y-1">
          {(activeEntity === "company"
            ? ["Name", "Domain", "Industry", "Size", "Revenue", "Description"]
            : activeEntity === "contact"
            ? ["First Name", "Last Name", "Email", "Title", "Phone", "LinkedIn URL"]
            : ["Name", "Stage", "Value", "Summary", "Close Date"]
          ).map((field) => (
            <div key={field} className="flex items-center justify-between rounded-md px-3 py-2"
              style={{ background: "var(--color-bg-surface)", border: "0.5px solid var(--color-border-default)" }}>
              <div className="flex items-center gap-3">
                <span className="text-[13px]" style={{ color: "var(--color-text-primary)" }}>{field}</span>
                <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: "var(--color-bg-muted)", color: "var(--color-text-muted)" }}>
                  Built-in
                </span>
              </div>
              <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>Text</span>
            </div>
          ))}
        </div>
      </div>

      {/* Custom fields */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
            Custom fields
          </span>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 text-[12px] font-medium"
            style={{ color: "var(--color-accent)" }}>
            <Plus size={13} /> Create field
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="skeleton h-12 rounded-md" />)}
          </div>
        ) : entityFields.length === 0 && !showAdd ? (
          <div className="rounded-md py-8 text-center" style={{ background: "var(--color-bg-surface)", border: "0.5px solid var(--color-border-default)" }}>
            <p className="text-[13px]" style={{ color: "var(--color-text-tertiary)" }}>
              No custom fields for {activeEntity === "company" ? "companies" : activeEntity === "contact" ? "contacts" : "deals"}.
            </p>
            <button onClick={() => setShowAdd(true)}
              className="mt-2 text-[12px] font-medium" style={{ color: "var(--color-accent)" }}>
              + Create your first field
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {entityFields.map((field) => (
              <div key={field.id} className="flex items-center justify-between rounded-md px-3 py-2"
                style={{ background: "var(--color-bg-surface)", border: "0.5px solid var(--color-border-default)" }}>
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>{field.name}</span>
                  <span className="rounded px-1.5 py-0.5 text-[10px] capitalize" style={{ background: "var(--color-bg-muted)", color: "var(--color-text-secondary)" }}>
                    {field.type.replace("_", " ")}
                  </span>
                  {field.options && field.options.length > 0 && (
                    <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                      {field.options.length} options
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* AI fill mode */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>AI:</span>
                    {AI_FILL_MODES.map((mode) => (
                      <button key={mode.value} onClick={() => updateFieldAiMode(field.id, mode.value)}
                        className="rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors"
                        style={{
                          background: field.aiFillMode === mode.value ? "var(--color-accent-soft)" : "transparent",
                          color: field.aiFillMode === mode.value ? "var(--color-accent)" : "var(--color-text-muted)",
                        }}>
                        {mode.label}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => removeField(field.id)}
                    className="flex h-6 w-6 items-center justify-center rounded-md transition-colors"
                    style={{ color: "var(--color-text-muted)" }}>
                    <X size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add field form */}
        {showAdd && (
          <div className="mt-2 rounded-md p-4" style={{ background: "var(--color-bg-surface)", border: "0.5px solid var(--color-accent)" }}>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium" style={{ color: "var(--color-text-secondary)" }}>Field name</label>
                <input value={newField.name} onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                  placeholder="e.g. Funding Round"
                  autoFocus
                  className="mt-1 h-8 w-full rounded-md px-3 text-[13px] outline-none"
                  style={{ background: "var(--color-bg-muted)", border: "0.5px solid var(--color-border-moderate)", color: "var(--color-text-primary)" }} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] font-medium" style={{ color: "var(--color-text-secondary)" }}>Type</label>
                  <div className="relative mt-1">
                    <select value={newField.type} onChange={(e) => setNewField({ ...newField, type: e.target.value })}
                      className="h-8 w-full appearance-none rounded-md px-3 pr-8 text-[12px] outline-none"
                      style={{ background: "var(--color-bg-muted)", border: "0.5px solid var(--color-border-moderate)", color: "var(--color-text-primary)" }}>
                      {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-2.5" style={{ color: "var(--color-text-muted)" }} />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-[11px] font-medium" style={{ color: "var(--color-text-secondary)" }}>AI fill mode</label>
                  <div className="mt-1 flex gap-1">
                    {AI_FILL_MODES.map((mode) => (
                      <button key={mode.value} onClick={() => setNewField({ ...newField, aiFillMode: mode.value })}
                        className="flex-1 rounded-md py-1.5 text-[11px] font-medium transition-colors"
                        style={{
                          background: newField.aiFillMode === mode.value ? "var(--color-accent-soft)" : "var(--color-bg-muted)",
                          color: newField.aiFillMode === mode.value ? "var(--color-accent)" : "var(--color-text-tertiary)",
                          border: newField.aiFillMode === mode.value ? "0.5px solid var(--color-accent)" : "0.5px solid var(--color-border-default)",
                        }}>
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {newField.type.includes("select") && (
                <div>
                  <label className="text-[11px] font-medium" style={{ color: "var(--color-text-secondary)" }}>Options (comma-separated)</label>
                  <input value={newField.options} onChange={(e) => setNewField({ ...newField, options: e.target.value })}
                    placeholder="e.g. Seed, Series A, Series B, Series C"
                    className="mt-1 h-8 w-full rounded-md px-3 text-[13px] outline-none"
                    style={{ background: "var(--color-bg-muted)", border: "0.5px solid var(--color-border-moderate)", color: "var(--color-text-primary)" }} />
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={addField} disabled={!newField.name.trim() || saving}
                  className="rounded-md px-4 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
                  style={{ background: "var(--color-accent)" }}>
                  {saving ? "Creating..." : "Create field"}
                </button>
                <button onClick={() => setShowAdd(false)}
                  className="rounded-md px-4 py-1.5 text-[12px] font-medium"
                  style={{ color: "var(--color-text-tertiary)" }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
