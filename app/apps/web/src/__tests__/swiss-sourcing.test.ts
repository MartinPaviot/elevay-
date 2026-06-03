import { describe, it, expect } from "vitest";
import {
  cantonCode,
  isSameCanton,
  cantonSynonyms,
  cantonCodes,
} from "@/lib/integrations/swiss-cantons";
import { normalizeFirm, pickBestMatch, type ZefixFirm } from "@/lib/integrations/zefix-client";

describe("swiss cantons", () => {
  it("resolves names (FR/DE/EN) and codes to the 2-letter code", () => {
    for (const v of ["Geneva", "Genève", "Genf", "GE", "ge"]) expect(cantonCode(v)).toBe("GE");
    expect(cantonCode("Vaud")).toBe("VD");
    expect(cantonCode("Zoug")).toBe("ZG");
    expect(cantonCode("Zürich")).toBe("ZH");
    expect(cantonCode("Zurich")).toBe("ZH");
    expect(cantonCode("Neuchâtel")).toBe("NE");
    expect(cantonCode("Paris")).toBeNull();
  });
  it("matches cantons across languages (the CH geography-fit fix)", () => {
    expect(isSameCanton("Geneva", "Genève")).toBe(true);
    expect(isSameCanton("Zurich", "Zürich")).toBe(true);
    expect(isSameCanton("Vaud", "Zug")).toBe(false);
  });
  it("expands a canton to all its synonyms", () => {
    const syn = cantonSynonyms("Geneva");
    expect(syn).toContain("GE");
    expect(syn).toContain("Genève");
    expect(syn).toContain("Genf");
  });
  it("maps an ICP-2 canton list to codes, dropping non-Swiss", () => {
    expect(cantonCodes(["Geneva", "Vaud", "Zug", "Zurich", "Paris"])).toEqual(["GE", "VD", "ZG", "ZH"]);
  });
});

describe("zefix normalizeFirm", () => {
  it("flattens legalForm + maps status to active", () => {
    const f = normalizeFirm({
      uid: "CHE-123.456.789",
      name: "Acme Finance SA",
      canton: "GE",
      legalForm: { name: "Société anonyme" },
      legalSeat: "Genève",
      status: "ACTIVE",
    });
    expect(f.uid).toBe("CHE-123.456.789");
    expect(f.legalForm).toBe("Société anonyme");
    expect(f.canton).toBe("GE");
    expect(f.active).toBe(true);
  });
  it("marks a deleted firm inactive", () => {
    expect(normalizeFirm({ name: "X", status: "DELETED" }).active).toBe(false);
  });
});

describe("zefix pickBestMatch", () => {
  const firms: ZefixFirm[] = [
    { uid: "1", name: "Acme Holding SA", canton: "GE", legalForm: null, legalSeat: null, active: true, purpose: null },
    { uid: "2", name: "Acme Finance SA", canton: "GE", legalForm: null, legalSeat: null, active: true, purpose: null },
  ];
  it("prefers an exact normalized name match", () => {
    expect(pickBestMatch("Acme Finance SA", firms)?.uid).toBe("2");
  });
  it("falls back to a contains match", () => {
    expect(pickBestMatch("Acme Finance", firms)?.uid).toBe("2");
  });
  it("returns null on no firms", () => {
    expect(pickBestMatch("X", [])).toBeNull();
  });
});
