/**
 * country -> ISO 3166-1 alpha-2 (spec 01, AC2). Accepts free-form country
 * names (EN + FR variants), alpha-2, and alpha-3, returns the canonical
 * alpha-2 code (uppercase) or null. Pure. Table is focused on Elevay's target
 * geos (FR/CH/EU + major markets) and is extensible.
 */

// alpha-2 -> { en, fr, alpha3, aliases }. Inverted at module load into a
// lookup keyed by every normalized variant.
const COUNTRIES: Record<string, { en: string; fr: string; alpha3: string; aliases?: string[] }> = {
  FR: { en: "France", fr: "France", alpha3: "FRA" },
  CH: { en: "Switzerland", fr: "Suisse", alpha3: "CHE", aliases: ["schweiz", "svizzera"] },
  BE: { en: "Belgium", fr: "Belgique", alpha3: "BEL" },
  LU: { en: "Luxembourg", fr: "Luxembourg", alpha3: "LUX" },
  DE: { en: "Germany", fr: "Allemagne", alpha3: "DEU", aliases: ["deutschland"] },
  GB: { en: "United Kingdom", fr: "Royaume-Uni", alpha3: "GBR", aliases: ["uk", "great britain", "england", "angleterre"] },
  IE: { en: "Ireland", fr: "Irlande", alpha3: "IRL" },
  NL: { en: "Netherlands", fr: "Pays-Bas", alpha3: "NLD", aliases: ["holland"] },
  ES: { en: "Spain", fr: "Espagne", alpha3: "ESP" },
  PT: { en: "Portugal", fr: "Portugal", alpha3: "PRT" },
  IT: { en: "Italy", fr: "Italie", alpha3: "ITA" },
  AT: { en: "Austria", fr: "Autriche", alpha3: "AUT" },
  SE: { en: "Sweden", fr: "Suède", alpha3: "SWE" },
  NO: { en: "Norway", fr: "Norvège", alpha3: "NOR" },
  DK: { en: "Denmark", fr: "Danemark", alpha3: "DNK" },
  FI: { en: "Finland", fr: "Finlande", alpha3: "FIN" },
  PL: { en: "Poland", fr: "Pologne", alpha3: "POL" },
  US: { en: "United States", fr: "États-Unis", alpha3: "USA", aliases: ["usa", "us", "united states of america", "etats-unis", "amerique"] },
  CA: { en: "Canada", fr: "Canada", alpha3: "CAN" },
  AU: { en: "Australia", fr: "Australie", alpha3: "AUS" },
  NZ: { en: "New Zealand", fr: "Nouvelle-Zélande", alpha3: "NZL" },
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const LOOKUP = new Map<string, string>();
for (const [iso, c] of Object.entries(COUNTRIES)) {
  LOOKUP.set(iso.toLowerCase(), iso);
  LOOKUP.set(norm(c.alpha3), iso);
  LOOKUP.set(norm(c.en), iso);
  LOOKUP.set(norm(c.fr), iso);
  for (const a of c.aliases ?? []) LOOKUP.set(norm(a), iso);
}

/** Resolve a free-form country to ISO 3166-1 alpha-2, or null if unknown. */
export function countryToIso(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  // Fast path: already a valid 2-letter code.
  if (/^[A-Za-z]{2}$/.test(raw)) {
    const up = raw.toUpperCase();
    if (COUNTRIES[up]) return up;
  }
  return LOOKUP.get(norm(raw)) ?? null;
}
