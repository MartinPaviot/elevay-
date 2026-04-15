"use client";

import { useState, useRef } from "react";
import { Upload, FileUp, Check, AlertCircle, X, FileText, Loader2 } from "lucide-react";
import { Button } from "./ui/button";

interface ImportResult {
  success: boolean;
  entityType: string;
  mapping: Record<string, string>;
  created: number;
  skipped: number;
  errors: number;
  totalRows: number;
}

export function SmartImport({ onClose, onComplete }: { onClose: () => void; onComplete?: () => void }) {
  const [step, setStep] = useState<"upload" | "processing" | "result">("upload");
  const [csvText, setCsvText] = useState("");
  // K4 — index of the row the user has marked as the header. Defaults to
  // 0 (most CSVs are clean); bumped when the user has metadata above the
  // real header (notes, source URL, exported-at timestamps, etc.). The
  // value indexes into `csvLines`, NOT into the raw `csvText` string.
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [entityType, setEntityType] = useState<string>("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(file: File) {
    const text = await file.text();
    setCsvText(text);
    setHeaderRowIndex(0);
  }

  async function handleImport() {
    if (!csvText.trim()) return;
    setStep("processing");
    setError(null);

    // K4 — when the user said the header isn't at row 0 we strip the
    // metadata prefix client-side and send a clean CSV so the import
    // route doesn't need to learn about header offsets.
    const trimmedCsv =
      headerRowIndex === 0
        ? csvText
        : csvText.split("\n").slice(headerRowIndex).join("\n");

    try {
      const res = await fetch("/api/import/smart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText: trimmedCsv, entityType: entityType || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Import failed");
        setStep("upload");
        return;
      }

      setResult(data);
      setStep("result");
    } catch (err) {
      setError(String(err));
      setStep("upload");
    }
  }

  const csvLines = csvText.split("\n").filter(Boolean);
  // K4 — preview the first 5 non-empty lines so the user can see which
  // one is the actual header. Capped here, not in state, so the picker
  // never tries to render thousands of options on a huge file.
  const headerCandidates = csvLines.slice(0, Math.min(5, csvLines.length));
  // Clamp to a valid index whenever the file changes underneath us.
  const safeHeaderRowIndex = Math.min(headerRowIndex, Math.max(0, csvLines.length - 1));
  const headers = csvLines[safeHeaderRowIndex]?.split(",").map((h) => h.trim().replace(/^["']|["']$/g, "")) || [];
  const previewRows = csvLines
    .slice(safeHeaderRowIndex + 1, safeHeaderRowIndex + 4)
    .map((l) => l.split(",").map((c) => c.trim().replace(/^["']|["']$/g, "")));
  const dataRowCount = Math.max(0, csvLines.length - safeHeaderRowIndex - 1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0, 0, 0, 0.5)" }}
    >
      <div
        className="w-full max-w-2xl rounded-xl"
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border-default)",
          boxShadow: "var(--shadow-card)",
          maxHeight: "80vh",
          overflow: "auto",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--color-border-default)" }}
        >
          <div className="flex items-center gap-2">
            <FileUp size={16} style={{ color: "var(--color-accent)" }} />
            <h2 className="text-[16px] font-semibold"
              style={{ color: "var(--color-text-primary)" }}>
              Smart Import
            </h2>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}>
              Auto-mapped
            </span>
          </div>
          <button onClick={onClose} style={{ color: "var(--color-text-tertiary)" }}>
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4">
          {step === "upload" && (
            <div className="space-y-4">
              <p className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                Upload a CSV file and Elevay will automatically detect the entity type and map columns to CRM fields.
              </p>

              {/* File upload area */}
              <div
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors"
                style={{ borderColor: "var(--color-border-default)" }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--color-accent)"; }}
                onDragLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border-default)"; }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = "var(--color-border-default)";
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileUpload(file);
                }}
              >
                <Upload size={24} style={{ color: "var(--color-text-tertiary)" }} />
                <span className="mt-2 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                  Drop CSV file here or click to browse
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
              </div>

              {/* Or paste CSV */}
              <div>
                <label className="mb-1 block text-[12px] font-medium"
                  style={{ color: "var(--color-text-tertiary)" }}>
                  Or paste CSV data:
                </label>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="name,email,company&#10;John Doe,john@example.com,Acme Inc"
                  className="w-full rounded-lg p-3 text-[12px] font-mono outline-none"
                  rows={5}
                  style={{
                    background: "var(--color-bg-muted)",
                    border: "1px solid var(--color-border-default)",
                    color: "var(--color-text-primary)",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* K4 — Header row picker. Only shown when the file has
                   enough rows to be ambiguous (>= 2). For a single-row
                   file there's nothing to disambiguate. */}
              {csvLines.length >= 2 && csvText.trim() && (
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <FileText size={13} style={{ color: "var(--color-text-tertiary)" }} />
                    <span className="text-[12px] font-medium"
                      style={{ color: "var(--color-text-secondary)" }}>
                      Pick your header row
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                      (skip metadata above the real column names)
                    </span>
                  </div>
                  <div className="space-y-1">
                    {headerCandidates.map((line, i) => {
                      const active = i === safeHeaderRowIndex;
                      return (
                        <label
                          key={i}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors"
                          style={{
                            background: active ? "var(--color-accent-soft)" : "var(--color-bg-page)",
                            border: `1px solid ${active ? "var(--color-accent)" : "var(--color-border-default)"}`,
                          }}
                        >
                          <input
                            type="radio"
                            name="headerRowIndex"
                            checked={active}
                            onChange={() => setHeaderRowIndex(i)}
                            className="h-3.5 w-3.5 shrink-0"
                          />
                          <span className="text-[11px] tabular-nums shrink-0" style={{ color: "var(--color-text-tertiary)" }}>
                            Row {i + 1}
                          </span>
                          <span
                            className="truncate text-[11px] font-mono"
                            style={{ color: "var(--color-text-primary)" }}
                            title={line}
                          >
                            {line}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Preview table */}
              {headers.length > 0 && csvText.trim() && (
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <FileText size={13} style={{ color: "var(--color-text-tertiary)" }} />
                    <span className="text-[12px] font-medium"
                      style={{ color: "var(--color-text-secondary)" }}>
                      Preview ({dataRowCount} row{dataRowCount === 1 ? "" : "s"})
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-lg"
                    style={{ border: "1px solid var(--color-border-default)" }}>
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr style={{ background: "var(--color-bg-muted)" }}>
                          {headers.map((h, i) => (
                            <th key={i} className="px-2 py-1.5 text-left font-medium"
                              style={{ color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border-default)" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => (
                          <tr key={i}>
                            {row.map((cell, j) => (
                              <td key={j} className="px-2 py-1"
                                style={{ color: "var(--color-text-primary)", borderBottom: "1px solid var(--color-border-default)" }}>
                                {cell || "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Entity type hint */}
              <div className="flex items-center gap-3">
                <label className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
                  Import as:
                </label>
                {["auto", "contact", "account", "deal"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setEntityType(type === "auto" ? "" : type)}
                    className="rounded-full px-3 py-1 text-[12px] font-medium transition-all"
                    style={{
                      background: (type === "auto" && !entityType) || entityType === type
                        ? "var(--color-accent)"
                        : "var(--color-bg-muted)",
                      color: (type === "auto" && !entityType) || entityType === type
                        ? "white"
                        : "var(--color-text-secondary)",
                    }}
                  >
                    {type === "auto" ? "Auto-detect" : type.charAt(0).toUpperCase() + type.slice(1) + "s"}
                  </button>
                ))}
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg p-3 text-[12px]"
                  style={{ background: "oklch(0.95 0.05 25)", color: "oklch(0.5 0.2 25)" }}>
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
                <Button
                  variant="solid"
                  size="sm"
                  onClick={handleImport}
                  disabled={!csvText.trim()}
                  icon={<FileUp size={13} />}
                >
                  Import with AI
                </Button>
              </div>
            </div>
          )}

          {step === "processing" && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin" style={{ color: "var(--color-accent)" }} />
              <span className="mt-3 text-[14px] font-medium"
                style={{ color: "var(--color-text-primary)" }}>
                AI is mapping your columns...
              </span>
              <span className="mt-1 text-[12px]"
                style={{ color: "var(--color-text-tertiary)" }}>
                Detecting entity type, mapping fields, importing data
              </span>
            </div>
          )}

          {step === "result" && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Check size={20} style={{ color: "oklch(0.6 0.15 145)" }} />
                <span className="text-[16px] font-semibold"
                  style={{ color: "var(--color-text-primary)" }}>
                  Import complete
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg p-3 text-center"
                  style={{ background: "var(--color-bg-muted)" }}>
                  <div className="text-[20px] font-bold"
                    style={{ color: "oklch(0.6 0.15 145)" }}>
                    {result.created}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                    {result.entityType}s created
                  </div>
                </div>
                <div className="rounded-lg p-3 text-center"
                  style={{ background: "var(--color-bg-muted)" }}>
                  <div className="text-[20px] font-bold"
                    style={{ color: "var(--color-text-secondary)" }}>
                    {result.skipped}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                    skipped
                  </div>
                </div>
                <div className="rounded-lg p-3 text-center"
                  style={{ background: "var(--color-bg-muted)" }}>
                  <div className="text-[20px] font-bold"
                    style={{ color: result.errors > 0 ? "oklch(0.6 0.2 25)" : "var(--color-text-secondary)" }}>
                    {result.errors}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                    errors
                  </div>
                </div>
              </div>

              {/* Field mapping used */}
              <div>
                <h3 className="mb-2 text-[12px] font-semibold"
                  style={{ color: "var(--color-text-tertiary)" }}>
                  Column mapping used:
                </h3>
                <div className="space-y-1">
                  {Object.entries(result.mapping).map(([csv, crm]) => (
                    <div key={csv} className="flex items-center gap-2 text-[12px]">
                      <span style={{ color: "var(--color-text-secondary)" }}>{csv}</span>
                      <span style={{ color: "var(--color-text-muted)" }}>→</span>
                      <span style={{ color: "var(--color-accent)", fontWeight: 500 }}>{crm}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="solid" size="sm" onClick={() => { onClose(); onComplete?.(); }}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
