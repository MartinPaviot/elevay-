import { describe, it, expect } from "vitest";
import { resolveHintedContact, normalizeLinkedin, type ResolvableContact } from "../signal-person";

const c = (over: Partial<ResolvableContact> & { id: string }): ResolvableContact => ({
  email: null,
  linkedinUrl: null,
  firstName: null,
  lastName: null,
  title: null,
  ...over,
});

describe("normalizeLinkedin", () => {
  it("strips protocol, www, trailing slash, query/hash", () => {
    expect(normalizeLinkedin("https://www.linkedin.com/in/jane-doe/")).toBe("linkedin.com/in/jane-doe");
    expect(normalizeLinkedin("linkedin.com/in/jane-doe?utm=x#f")).toBe("linkedin.com/in/jane-doe");
    expect(normalizeLinkedin(null)).toBe("");
  });
});

describe("resolveHintedContact", () => {
  const pool = [
    c({ id: "c1", email: "ceo@acme.com", firstName: "Ada", lastName: "King", title: "CEO" }),
    c({ id: "c2", email: "vp@acme.com", linkedinUrl: "https://www.linkedin.com/in/grace-h/", firstName: "Grace", lastName: "Hop", title: "VP Engineering" }),
    c({ id: "c3", email: "eng@acme.com", firstName: "Grace", lastName: "Hop", title: "Engineering Manager" }), // same name as c2
  ];

  it("null when no hint / no usable field", () => {
    expect(resolveHintedContact(pool, null)).toBeNull();
    expect(resolveHintedContact(pool, {})).toBeNull();
  });

  it("exact contactId wins over everything", () => {
    expect(resolveHintedContact(pool, { contactId: "c2", email: "ceo@acme.com", name: "Ada King" })?.id).toBe("c2");
  });

  it("email match is case-insensitive", () => {
    expect(resolveHintedContact(pool, { email: "VP@Acme.com" })?.id).toBe("c2");
  });

  it("LinkedIn URL match is normalized", () => {
    expect(resolveHintedContact(pool, { linkedinUrl: "linkedin.com/in/grace-h" })?.id).toBe("c2");
  });

  it("full-name match (single) resolves", () => {
    expect(resolveHintedContact(pool, { name: "Ada King" })?.id).toBe("c1");
  });

  it("ambiguous name disambiguated by title", () => {
    expect(resolveHintedContact(pool, { name: "Grace Hop", title: "VP Engineering" })?.id).toBe("c2");
    expect(resolveHintedContact(pool, { name: "Grace Hop", title: "Engineering Manager" })?.id).toBe("c3");
  });

  it("ambiguous name, no title → deterministic lowest id", () => {
    expect(resolveHintedContact(pool, { name: "Grace Hop" })?.id).toBe("c2");
  });

  it("a person not in the pool → null (never reaches outside the CRM)", () => {
    expect(resolveHintedContact(pool, { email: "stranger@nope.com" })).toBeNull();
    expect(resolveHintedContact(pool, { contactId: "ghost" })).toBeNull();
    expect(resolveHintedContact(pool, { name: "Someone Else" })).toBeNull();
  });

  it("precedence: contactId > email > linkedin > name", () => {
    // email points to c1, name points to c2 — email wins (higher precedence).
    expect(resolveHintedContact(pool, { email: "ceo@acme.com", name: "Grace Hop" })?.id).toBe("c1");
  });
});
