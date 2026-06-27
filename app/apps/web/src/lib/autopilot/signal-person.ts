/**
 * Resolve a signal's person hint to an existing CRM contact (Monaco signal→person:
 * write to the post author / hiring manager / warm connection, not the top-seniority
 * default). Matches ONLY against contacts already passed in — never enriches or
 * creates a contact (founder directive: no enrichment by default). Returns null when
 * nothing matches → the caller keeps the score-best contact.
 *
 * Match precedence (strongest first):
 *   1. exact CRM contactId (the producer already resolved one),
 *   2. email (case-insensitive),
 *   3. LinkedIn URL (normalized),
 *   4. full name, disambiguated by title when several share a name.
 *
 * Pure — no IO. Generic over the contact row so callers pass their own shape.
 */

import { hasAnyHint, type SignalPerson } from "@/lib/signals/record-signal";

export interface ResolvableContact {
  id: string;
  email: string | null;
  linkedinUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  title?: string | null;
}

const norm = (s: string | null | undefined): string => (s ?? "").toLowerCase().trim();

/** Normalize a LinkedIn URL to `linkedin.com/in/<slug>` for comparison. */
export function normalizeLinkedin(url: string | null | undefined): string {
  const raw = norm(url);
  if (!raw) return "";
  return raw
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[?#]/)[0]
    .replace(/\/+$/, "");
}

const fullName = (c: ResolvableContact): string => norm([c.firstName, c.lastName].filter(Boolean).join(" "));

/** Resolve the hint to one of `contacts`, or null. Deterministic (ties → lowest id). */
export function resolveHintedContact<T extends ResolvableContact>(
  contacts: T[],
  person: SignalPerson | null | undefined,
): T | null {
  if (!hasAnyHint(person) || !person) return null;

  // 1. Exact CRM contact id.
  if (person.contactId) {
    const byId = contacts.find((c) => c.id === person.contactId);
    if (byId) return byId;
  }

  // 2. Email (case-insensitive, non-empty).
  if (person.email) {
    const e = norm(person.email);
    if (e) {
      const byEmail = contacts.filter((c) => norm(c.email) === e).sort((a, b) => (a.id < b.id ? -1 : 1));
      if (byEmail[0]) return byEmail[0];
    }
  }

  // 3. LinkedIn URL (normalized).
  if (person.linkedinUrl) {
    const ln = normalizeLinkedin(person.linkedinUrl);
    if (ln) {
      const byLn = contacts.filter((c) => normalizeLinkedin(c.linkedinUrl) === ln).sort((a, b) => (a.id < b.id ? -1 : 1));
      if (byLn[0]) return byLn[0];
    }
  }

  // 4. Full name, disambiguated by title.
  if (person.name) {
    const n = norm(person.name);
    const byName = contacts.filter((c) => fullName(c) === n).sort((a, b) => (a.id < b.id ? -1 : 1));
    if (byName.length === 1) return byName[0];
    if (byName.length > 1) {
      if (person.title) {
        const t = norm(person.title);
        const byTitle = byName.find((c) => {
          const ct = norm(c.title);
          return !!ct && (ct.includes(t) || t.includes(ct));
        });
        if (byTitle) return byTitle;
      }
      return byName[0]; // deterministic fallback (lowest id)
    }
  }

  return null;
}
