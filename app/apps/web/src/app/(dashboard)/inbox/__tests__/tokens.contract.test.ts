import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * F1 G-design gate (machine half) — no inbox .tsx may use a RAW color literal as
 * a color value; every color must be a var(--color-*) token. No exceptions:
 * SenderAvatar's former data-derived HSL carve-out was migrated to the badge
 * token system (continuity pass 2026-07-02).
 */

const here = dirname(fileURLToPath(import.meta.url));
const INBOX_DIR = join(here, ".."); // (dashboard)/inbox

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "__tests__") continue;
      out.push(...tsxFiles(p));
    } else if (name.endsWith(".tsx")) {
      out.push(p);
    }
  }
  return out;
}

/** Strip line + block comments so a hex in a comment isn't flagged. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

// Also catches template-literal hsl(`${...}`) which the digit-anchored form
// used to miss — that hole hid the avatar/label HSL bypasses for weeks.
const LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*[0-9$`]|hsl\(\s*[0-9$`]|oklch\(\s*[0-9.$`]/g;

describe("F1 tokens contract — no raw color literals in the inbox tree", () => {
  const files = tsxFiles(INBOX_DIR);

  it("scans a non-trivial set of inbox components", () => {
    expect(files.length).toBeGreaterThan(3);
  });

  it("every inbox .tsx uses var(--color-*), not a raw hex/rgb/hsl/oklch literal", () => {
    const violations: string[] = [];
    for (const f of files) {
      const body = stripComments(readFileSync(f, "utf8"));
      const hits = body.match(LITERAL);
      if (hits) violations.push(`${f.split(/[\\/]/).pop()}: ${[...new Set(hits)].join(", ")}`);
    }
    expect(violations, violations.join("\n")).toHaveLength(0);
  });
});
