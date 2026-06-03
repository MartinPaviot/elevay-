/**
 * Swiss canton synonyms ↔ 2-letter code (FR / DE / EN).
 *
 * Two uses:
 *   1. Zefix `canton` filter expects the 2-letter code (GE, VD, ZG, ZH).
 *   2. Geography fit-matching for CH: an ICP criterion says "Geneva"
 *      (EN), Apollo/Zefix may return "Genève" (FR) or "Genf" (DE). norm()
 *      strips accents but does NOT equate languages, so without this map
 *      "Geneva" ≠ "Genève" → a Swiss company would fail the geography
 *      criterion (same class of bug as the France accent issue).
 *
 * Pure.
 */

function norm(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[\s_-]+/g, " ").trim();
}

/** code → every name we might see (FR, DE, EN). */
const CANTONS: Record<string, string[]> = {
  AG: ["Aargau", "Argovie"],
  AI: ["Appenzell Innerrhoden", "Appenzell Rhodes-Intérieures"],
  AR: ["Appenzell Ausserrhoden", "Appenzell Rhodes-Extérieures"],
  BE: ["Bern", "Berne"],
  BL: ["Basel-Landschaft", "Bâle-Campagne"],
  BS: ["Basel-Stadt", "Bâle-Ville", "Basel", "Bâle"],
  FR: ["Fribourg", "Freiburg"],
  GE: ["Genève", "Geneva", "Genf"],
  GL: ["Glarus", "Glaris"],
  GR: ["Graubünden", "Grisons"],
  JU: ["Jura"],
  LU: ["Luzern", "Lucerne"],
  NE: ["Neuchâtel", "Neuenburg"],
  NW: ["Nidwalden", "Nidwald"],
  OW: ["Obwalden", "Obwald"],
  SG: ["St. Gallen", "Saint-Gall", "Sankt Gallen"],
  SH: ["Schaffhausen", "Schaffhouse"],
  SO: ["Solothurn", "Soleure"],
  SZ: ["Schwyz", "Schwytz"],
  TG: ["Thurgau", "Thurgovie"],
  TI: ["Ticino", "Tessin"],
  UR: ["Uri"],
  VD: ["Vaud", "Waadt"],
  VS: ["Valais", "Wallis"],
  ZG: ["Zug", "Zoug"],
  ZH: ["Zürich", "Zurich"],
};

// Reverse index: normalized name OR code → canton code.
const NAME_TO_CODE = new Map<string, string>();
for (const [code, names] of Object.entries(CANTONS)) {
  NAME_TO_CODE.set(norm(code), code);
  for (const n of names) NAME_TO_CODE.set(norm(n), code);
}

/** Resolve a canton value (name in any language, or code) → 2-letter code, or null. */
export function cantonCode(value: string): string | null {
  return NAME_TO_CODE.get(norm(value)) ?? null;
}

/** True when two canton values refer to the same canton (cross-language). */
export function isSameCanton(a: string, b: string): boolean {
  const ca = cantonCode(a);
  return ca !== null && ca === cantonCode(b);
}

/** All synonyms (+ code) for a canton value — feed these into a geography
 *  criterion / Apollo location list so CH matching is language-agnostic. */
export function cantonSynonyms(value: string): string[] {
  const code = cantonCode(value);
  if (!code) return [value];
  return [code, ...CANTONS[code]];
}

/** Map a list of canton values to their 2-letter codes (deduped). */
export function cantonCodes(values: string[]): string[] {
  const out = new Set<string>();
  for (const v of values) {
    const c = cantonCode(v);
    if (c) out.add(c);
  }
  return [...out];
}
