# Design Language — LeadSens

## Philosophy

Dense when data matters. Clean when conversation matters. The chat is Lightfield-clean. The pipeline is Monaco-dense. The transition should feel natural.

## Source of Truth

All design tokens are defined in `app/apps/web/src/app/globals.css` via `@theme {}` block.
Detailed specification: `_research/ui-teardown/our-design-system.md`

## Color System — CSS Custom Properties

```css
/* Backgrounds */
--color-bg-base: #09090b;        /* Page background */
--color-bg-surface: #121214;      /* Cards, panels */
--color-bg-elevated: #1a1a1f;     /* Modals, dropdowns */
--color-bg-muted: #222228;        /* Hover states, inputs */
--color-bg-emphasis: #2a2a31;     /* Selected, pressed */

/* Text (transparency-based) */
--color-text-primary: rgba(255,255,255,0.92);    /* Primary text */
--color-text-secondary: rgba(255,255,255,0.64);  /* Labels, headers */
--color-text-tertiary: rgba(255,255,255,0.45);   /* Descriptions, hints */
--color-text-muted: rgba(255,255,255,0.28);      /* Disabled, faint */

/* Borders (transparency-based) */
--color-border-default: rgba(255,255,255,0.08);  /* Subtle borders */
--color-border-moderate: rgba(255,255,255,0.12); /* Visible borders */
--color-border-strong: rgba(255,255,255,0.20);   /* Active elements */
--color-border-focus: rgba(99,102,241,0.5);      /* Focus rings */

/* Accent — indigo */
--color-accent: #6366f1;
--color-accent-hover: #818cf8;
--color-accent-soft: rgba(99,102,241,0.12);
--color-accent-muted: rgba(99,102,241,0.06);

/* Semantic */
--color-success: #22c55e;
--color-warning: #f59e0b;
--color-error: #ef4444;
--color-info: #3b82f6;
```

## Typography

```css
--font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'DM Mono', monospace;

/* Scale */
24px / 600 / -0.3px — Page titles (settings)
20px / 600 / -0.2px — Hero numbers, date headers
16px / 500 — Section headers
15px / 450 — Chat messages (special)
14px / 400 — Body text
13px / 400-500 — Nav items, secondary text
12px / 500 — Buttons, badges, labels
11px / 500 — Section headers (sidebar), smallest labels
```

## Key Design Decisions

### Sub-pixel borders (0.5px)
Adds definition without visual weight. Inspired by Lightfield's 0.666px borders.

### Transparency-based text/borders
Text uses rgba white values, borders use rgba white values. Both work automatically across any background shade.

### Badge auto-coloring
10 category colors assigned via hash function: `hash(string) % 10`. Each gets a 10% opacity background + darker text color.

### Chat distinction
Chat messages use 15px at weight 450 — larger and slightly bolder than the 13px nav/body text. This makes the AI conversation feel like a different mode.

## Layout Constants

```css
--sidebar-width: 240px;
--header-height: 44px;
--filter-bar-height: 40px;
--table-row-height: 40px;
--detail-panel-width: 400px;
--kanban-column-width: 260px;
```

## Component Patterns

### Page structure
Every page follows: Header bar (44px) → Filter bar (40px, on list pages) → Content area

### Buttons
- Primary: accent bg, white text, 28px height, 12px font, rounded-md
- Secondary: transparent, 0.5px border, rounded-md
- Ghost: transparent, no border, color transitions on hover

### Tables
- 40px row height, sticky headers, sub-pixel borders
- Headers: 11px uppercase, text-tertiary
- Hover: bg-muted background

### Cards
- bg-surface, 0.5px border, rounded-lg (8px)
- No shadows in dark mode

### Empty states
- Centered icon (32px, text-muted) + title + description + CTA

## Icons
Using lucide-react throughout. Standard size: 16px in nav, 13px in buttons, 32px in empty states.

## Animations
- Hover transitions: 150ms ease
- Skeleton shimmer: 1.5s linear infinite
- Page transitions: instant (no animation)
