/**
 * title -> { seniority, department } (spec 01, AC2). Reuses the tested mappers
 * in lib/enrichment/inference.ts and maps their seniority union onto the ONE
 * canonical seniority vocabulary (the Apollo enum in lib/contacts/seniority.ts),
 * resolving the two-vocabulary conflict the reconciliation found. Pure.
 *
 * The agentic role classifier is spec 16; this is deterministic rule mapping.
 */
import {
  inferSeniorityFromTitle,
  inferDepartmentFromTitle,
  type Seniority as InferredSeniority,
} from "@/lib/enrichment/inference";

/** Canonical seniority vocabulary (aligned to lib/contacts/seniority.ts). */
export type CanonicalSeniority =
  | "founder" | "c_suite" | "vp" | "head" | "director" | "manager"
  | "senior" | "entry" | "unknown";

const SENIORITY_MAP: Record<InferredSeniority, CanonicalSeniority> = {
  founder: "founder",
  c_level: "c_suite",
  vp: "vp",
  director: "director",
  manager: "manager",
  senior: "senior",
  ic: "entry",
  unknown: "unknown",
};

export interface NormalizedRole {
  seniority: CanonicalSeniority;
  department: string | null;
}

export function titleToRole(title: string | null | undefined): NormalizedRole {
  return {
    seniority: SENIORITY_MAP[inferSeniorityFromTitle(title)],
    department: inferDepartmentFromTitle(title),
  };
}
