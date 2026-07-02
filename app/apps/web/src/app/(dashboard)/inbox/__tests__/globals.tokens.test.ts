import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
// inbox/__tests__ → app/globals.css
const GLOBALS = join(here, "..", "..", "..", "globals.css");
const css = readFileSync(GLOBALS, "utf8");

describe("F1 inbox density tokens (globals.css)", () => {
  // Only the two CONSUMED density tokens remain. --inbox-sidebar-width,
  // --inbox-list-width and --inbox-cta-radius were dead (zero consumers) and
  // were deleted with the .inbox-shell reskin (continuity pass 2026-07-02).
  const expected: Record<string, string> = {
    "--inbox-row-height": "56px",
    "--inbox-row-height-compact": "34px",
  };

  it("defines the two --inbox-* density tokens with exact values", () => {
    for (const [name, value] of Object.entries(expected)) {
      expect(css, name).toMatch(new RegExp(`${name}\\s*:\\s*${value.replace(".", "\\.")}\\s*;`));
    }
  });

  it("the INBOX DENSITY block introduces no color/gradient/shadow token", () => {
    const block = css.slice(css.indexOf("=== INBOX DENSITY"), css.indexOf("=== BADGE CATEGORY"));
    expect(block).not.toMatch(/--color-/);
    expect(block).not.toMatch(/--gradient-/);
    expect(block).not.toMatch(/--shadow-/);
  });

  it("the .inbox-shell token fork stays dead — the inbox reads root tokens (continuity, 2026-07-02)", () => {
    // A scoped selector that re-binds --color-*/--shadow-* tokens for the
    // inbox is the regression this pass removed. The inert marker comment may
    // mention the name; an actual CSS rule must not.
    expect(css).not.toMatch(/\.inbox-shell\s*\{/);
    expect(css).not.toMatch(/\.inbox-rail\s*\{/);
    expect(css).not.toMatch(/backdrop-filter/);
  });
});
