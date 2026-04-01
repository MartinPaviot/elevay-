# Office Hours: UI-REDESIGN

## Problem Statement
Our product UI looks like a homework project compared to Monaco and Lightfield. It uses hardcoded hex colors, inconsistent spacing, rounded-lg everywhere, and lacks the polish of production CRM software.

## Premise Challenge
**Current premise**: "Dark mode with Inter font and indigo accent is enough to look professional."
**Challenge**: Both competitors prove that polish comes from systematic design tokens, sub-pixel borders, transparency-based colors, consistent spacing, and distinctive typography choices (like Lightfield's 425/450 weights).

## Alternatives Explored

### A: Adopt Lightfield's system wholesale (light mode, system fonts, OKLCH)
- Pro: Most polished competitor UI, live-inspected exact values
- Con: Light mode is a big departure from our current dark-first approach; OKLCH has limited browser support
- **Verdict**: Take the TOKEN ARCHITECTURE (transparency, sub-pixel borders, spacing) but keep our dark theme

### B: Adopt Monaco's system (dark mode, dense tables, scoring-focused)
- Pro: Same dark aesthetic we use, data-dense tables for power users
- Con: Monaco is MORE dense than a founder-led sales tool needs; screenshots only, no exact values
- **Verdict**: Take the DATA DENSITY for tables and scoring display, but not the overall density

### C: Hybrid system (dark mode + Lightfield polish + Monaco data patterns)
- Pro: Best of both — Monaco's information density where data matters, Lightfield's cleanliness where conversation matters
- Con: More work to synthesize
- **Verdict**: THIS IS THE WAY. Our design-language.md already says this: "Dense when data matters. Clean when conversation matters."

## Layer Check
- Layer 1 (tried and true): Tailwind CSS 4, CSS custom properties — well-established
- Layer 2 (new and popular): OKLCH colors, sub-pixel borders — modern CSS, good support
- Layer 3 (first principles): Transparency-based theming, auto-color badges — novel but proven by Lightfield

## Completeness Target: 9/10
Every page must be rebuilt with the design system. No shortcuts on spacing, colors, or component consistency.

## Key Decisions
1. Keep Inter font (not system fonts) — we need variable font weights for 450 chat text
2. Keep dark mode first — matches our brand and Monaco aesthetic
3. Adopt Lightfield's token architecture — transparency-based, sub-pixel borders
4. Adopt Monaco's data density for tables — 40px rows, 12px cell text, dense headers
5. Adopt Lightfield's chat styling — 15px text, subtle user bubbles, no AI bubble bg
6. Build a CSS custom property layer in globals.css — no more hardcoded hex in components
