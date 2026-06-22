/**
 * industry -> NAICS sector code (spec 01, AC2). Maps a free-form industry label
 * to a NAICS 2-digit sector (the open vocabulary the data-contract anchors on).
 * Focused, keyword-based, extensible; returns null when nothing matches. Pure.
 *
 * Note: the inverse crosswalk (NAICS code -> Apollo industry string) already
 * lives in lib/icp/naics-to-apollo-industry.ts; this is the forward direction.
 */

// NAICS 2-digit sectors -> matching keywords (lowercased, substring match).
const SECTORS: Array<{ code: string; label: string; keywords: string[] }> = [
  { code: "11", label: "Agriculture, Forestry, Fishing and Hunting", keywords: ["agricultur", "farming", "forestry", "fishing"] },
  { code: "21", label: "Mining, Quarrying, and Oil and Gas Extraction", keywords: ["mining", "oil", "gas extraction", "quarry"] },
  { code: "22", label: "Utilities", keywords: ["utilities", "electric power", "water supply", "energy utility"] },
  { code: "23", label: "Construction", keywords: ["construction", "building", "civil engineering", "btp"] },
  { code: "31-33", label: "Manufacturing", keywords: ["manufactur", "industrial", "factory", "production", "machinery", "automotive"] },
  { code: "42", label: "Wholesale Trade", keywords: ["wholesale", "distribution", "distributor"] },
  { code: "44-45", label: "Retail Trade", keywords: ["retail", "e-commerce", "ecommerce", "consumer goods", "store"] },
  { code: "48-49", label: "Transportation and Warehousing", keywords: ["transport", "logistics", "warehous", "shipping", "freight"] },
  { code: "51", label: "Information", keywords: ["software", "saas", "information technology", "internet", "media", "publishing", "telecommunication", "it services", "computer"] },
  { code: "52", label: "Finance and Insurance", keywords: ["finance", "financial", "bank", "insurance", "fintech", "investment", "asset management"] },
  { code: "53", label: "Real Estate and Rental and Leasing", keywords: ["real estate", "property", "leasing", "proptech"] },
  { code: "54", label: "Professional, Scientific, and Technical Services", keywords: ["consulting", "professional services", "legal", "accounting", "engineering services", "research", "marketing agency", "design"] },
  { code: "56", label: "Administrative and Support Services", keywords: ["staffing", "recruiting", "facilities", "administrative", "call center"] },
  { code: "61", label: "Educational Services", keywords: ["education", "edtech", "training", "school", "university", "e-learning"] },
  { code: "62", label: "Health Care and Social Assistance", keywords: ["health", "healthcare", "medical", "hospital", "biotech", "pharma", "healthtech", "clinic"] },
  { code: "71", label: "Arts, Entertainment, and Recreation", keywords: ["entertainment", "gaming", "sports", "arts", "recreation"] },
  { code: "72", label: "Accommodation and Food Services", keywords: ["hospitality", "hotel", "restaurant", "food service", "travel"] },
  { code: "81", label: "Other Services", keywords: ["non-profit", "nonprofit", "association", "repair", "personal services"] },
  { code: "92", label: "Public Administration", keywords: ["government", "public sector", "public administration", "defense"] },
];

export interface NaicsSector {
  code: string;
  label: string;
}

export function industryToNaics(input: string | null | undefined): NaicsSector | null {
  if (!input) return null;
  const t = input.toLowerCase();
  for (const s of SECTORS) {
    if (s.keywords.some((k) => t.includes(k))) return { code: s.code, label: s.label };
  }
  return null;
}
