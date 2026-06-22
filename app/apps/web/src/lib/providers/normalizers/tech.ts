/**
 * tech -> slug (spec 01, AC2). Canonicalizes a technology display name (e.g.
 * "Next.js", "Google Analytics") into a stable slug ("nextjs",
 * "google-analytics"), collapsing known aliases so the same tech from different
 * providers maps to one slug. Pure.
 */

// Canonical aliases: any of the variants -> the canonical slug.
const ALIASES: Record<string, string> = {
  "next.js": "nextjs",
  "nextjs": "nextjs",
  "node.js": "nodejs",
  "nodejs": "nodejs",
  "react.js": "react",
  "reactjs": "react",
  "vue.js": "vuejs",
  "google analytics": "google-analytics",
  "ga4": "google-analytics",
  "google tag manager": "google-tag-manager",
  "gtm": "google-tag-manager",
  "hubspot": "hubspot",
  "salesforce": "salesforce",
  "amazon web services": "aws",
  "aws": "aws",
  "google cloud platform": "gcp",
  "gcp": "gcp",
  "microsoft azure": "azure",
  "azure": "azure",
};

/** Lowercase, strip dots, non-alphanumerics -> hyphens, collapse. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function techToSlug(input: string | null | undefined): string | null {
  if (!input) return null;
  const key = input.toLowerCase().trim();
  if (ALIASES[key]) return ALIASES[key];
  const slug = slugify(input);
  return slug || null;
}
