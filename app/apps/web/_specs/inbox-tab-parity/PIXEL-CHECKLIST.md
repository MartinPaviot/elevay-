# Pixel parity checklist — Elevay inbox vs Upstream (MEASURED)

> Method: NOT eyeballed. Values read live via `getComputedStyle` on both apps
> (Upstream app.upstream.do + ours :3007), 2026-06-20. Re-run the measurement
> evaluate (see bottom) after any UI change and update the deltas.

## List row

| Property | Upstream | Ours | Δ | Verdict |
|----------|----------|------|---|---------|
| Row height | 44px | 44px | 0 | ✅ MATCH |
| Row padding (x) | — | 0 12px | — | ok |
| Avatar | (img) | 22px | — | ok |
| Sender — read | 14px / 400 / rgb(15,23,42) | 14px / 400 / rgb(26,26,46) | size+weight 0; colour ~equal (both near-black) | ✅ MATCH |
| Sender — unread | 14px / **700** | 14px / **700** (font-bold) | 0 | ✅ MATCH |
| Subject | 14px (combined w/ sender el on UP) | 14px / 400 read · 500 unread | ~ | ✅ ~MATCH |
| Snippet | 14px / 400 / rgba(10,25,41,0.6) | 14px / rgb(100,100,140) (muted) | size 0; both ~60% muted | ✅ MATCH |
| Date | **14px** / rgb(163,163,163) | **12px** / text-tertiary | **−2px** | ⚠️ FIX |
| Unread dot | blue, leading | blue (var(--color-accent)), leading slot | — | ✅ MATCH |

## Split-tab strip

| Property | Upstream | Ours | Δ | Verdict |
|----------|----------|------|---|---------|
| Tab font | **14px / 400** | **13px / 500** | −1px, +100 weight | ⚠️ FIX |
| Tab colour (inactive) | rgba(10,25,41,0.7) | rgb(100,100,140) | ~equal (muted) | ✅ ~MATCH |
| Tab padding | 0 (link) | 8px 12px | — | n/a (different layout) |

## Sidebar folder item

| Property | Upstream | Ours | Δ | Verdict |
|----------|----------|------|---|---------|
| Item font | **14px / 400** | **13px / 400** | −1px | ⚠️ FIX |
| Item height | 32px | 31.5px | ~0 | ✅ MATCH |

## Top bar

| Property | Upstream | Ours | Δ | Verdict |
|----------|----------|------|---|---------|
| Search height | 32px | ~33px | ~0 | ✅ MATCH |
| Folder title (band) | — | 14px / 600 | — | ok |

## Summary

**Core list anatomy is at parity** (44px row, 14px sender/subject/snippet,
unread=700 bold, muted snippet, leading unread dot — all match). The measurable
gaps are all the same root: **Upstream renders the inbox uniformly at 14px**,
while ours drops to **12px (date)** and **13px (split-tabs, sidebar)**. Three
1–2px fixes close it:
- LT-px1: list row date 12px → 14px (`_inbox-row.tsx`).
- LT-px2: split-tab font 13px/500 → 14px/400 (`_split-strip.tsx`).
- LT-px3: sidebar folder item 13px → 14px (`_inbox-folders.tsx`).

Not yet measured (need populated/visible state): thread reading-view subject vs
Upstream 24px; composer; hover quick-actions; exact category-dot colours.

## Re-run measurement (paste into browser_evaluate on each app)

Ours: anchor on `[data-conversation-key]` + `.min-w-0.flex-1 > span`.
Upstream: anchor by sender text (`findExact('Rahul Vohra')` read / `findStarts('LegalPlace')` unread),
walk up to width>500 for the row height. Read fontSize/fontWeight/color via getComputedStyle.
