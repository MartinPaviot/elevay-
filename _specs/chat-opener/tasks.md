# chat-opener — Tasks (v1)

1. **lib/chat/opener.ts** — pure builder + types.
   Verify: vitest `opener.test.ts` (priority order, caps, singular/plural,
   truncation, all-clear, resume slot, recipe fill, task-kind ignored).
2. **app/api/chat/opener/route.ts** — assemble inputs, degrade per source.
   Verify: manual curl on dev (200 with auth, 401 without), never throws
   with empty tenant.
3. **chat-dock.tsx** — opener empty state + skeletons + fallback + resume +
   metrics.
   Verify: tsc, existing dock behavior untouched (send, persistence),
   live visual check on dev with the real account (screenshots).
4. **Evaluate** — Playwright: open dock on /home, assert opener text +
   chips render from live data; click a chip → message sent; error path
   (block the route) → static chips.
5. **Doc update** — design-language: chat dock opener pattern note if PASS.
