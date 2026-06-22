// Shared normalizers (spec 01, AC2). The six deterministic mappers every
// adapter calls instead of normalizing ad-hoc. The agentic role classifier is
// spec 16; everything here is rule/table mapping.
export { countryToIso } from "./country";
export { toE164 } from "./phone";
export { titleToRole, type NormalizedRole, type CanonicalSeniority } from "./title";
export { industryToNaics, type NaicsSector } from "./industry";
export { techToSlug } from "./tech";
export { employeesToRange, type EmployeeRange } from "./employees";
