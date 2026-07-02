import { describe, it, expect } from "vitest";
import { senderNameOf, senderEmailOf } from "../sender-display";

// Regression for the live audit 2026-07-02: raw RFC headers rendered verbatim
// across the inbox (list rows, pane header ×2, message lines, booking payload).
describe("sender-display", () => {
  it("extracts the display name from a full header", () => {
    expect(senderNameOf("Sarah Kimura <sarah.kimura@northwindsaas.test>")).toBe("Sarah Kimura");
  });

  it("strips wrapping quotes from the display name", () => {
    expect(senderNameOf('"O\'Connor, James" <james@brightpath.test>')).toBe("O'Connor, James");
  });

  it("falls back to the address when the header has no name part", () => {
    expect(senderNameOf("tom.reyes@quarrylane.test")).toBe("tom.reyes@quarrylane.test");
    expect(senderNameOf("<tom.reyes@quarrylane.test>")).toBe("tom.reyes@quarrylane.test");
  });

  it("handles empty/null input", () => {
    expect(senderNameOf("")).toBe("");
    expect(senderNameOf(null)).toBe("");
    expect(senderEmailOf(undefined)).toBe("");
  });

  it("extracts + lowercases the address", () => {
    expect(senderEmailOf("Marc Delorme <Marc.Delorme@AtelierFrancais.test>")).toBe("marc.delorme@atelierfrancais.test");
    expect(senderEmailOf("noreply@saasweekly.test")).toBe("noreply@saasweekly.test");
  });
});
