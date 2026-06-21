import { describe, it, expect } from "vitest";
import {
  SCRIPT_LANGUAGES,
  SCRIPT_LANGUAGE_NAME,
  SCRIPT_LANGUAGE_SHORT,
  asScriptLanguage,
} from "@/lib/call-mode/script-language";

describe("script-language", () => {
  it("narrows valid codes, defaults everything else to fr", () => {
    expect(asScriptLanguage("fr")).toBe("fr");
    expect(asScriptLanguage("en")).toBe("en");
    expect(asScriptLanguage("de")).toBe("de");
    expect(asScriptLanguage("it")).toBe("it");
    // Unknown / malformed / missing → FR (the romand default), never throws.
    expect(asScriptLanguage("es")).toBe("fr");
    expect(asScriptLanguage("")).toBe("fr");
    expect(asScriptLanguage(null)).toBe("fr");
    expect(asScriptLanguage(undefined)).toBe("fr");
    expect(asScriptLanguage(42)).toBe("fr");
  });

  it("has a prompt name and a short label for every language", () => {
    for (const lng of SCRIPT_LANGUAGES) {
      expect(SCRIPT_LANGUAGE_NAME[lng]).toBeTruthy();
      expect(SCRIPT_LANGUAGE_SHORT[lng]).toBe(lng.toUpperCase());
    }
  });
});
