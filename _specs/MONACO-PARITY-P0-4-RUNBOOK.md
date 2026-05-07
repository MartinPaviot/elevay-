# MONACO-PARITY P0-4 — Coaching Transcript-Grounded RUNBOOK

Operational manual for the transcript-coaching surface (RAG over
meeting recordings). Linked from the citation-chip tooltip and from
the eval dashboard description fields.

## What the system does

When a founder asks the chat panel "what did Sarah push back on?",
the coaching tool retrieves the most relevant verbatim chunks from
that customer's meeting transcripts via cosine similarity over
pgvector embeddings, formats them into a prompt block with `[mm:ss]`
timestamps, and feeds the block to the LLM with strict instructions
to quote verbatim, cite the right timestamp, and refuse cleanly when
no chunks support the answer. Each `[mm:ss]` in the response renders
as a clickable chip that opens the recording at that exact moment.

## Core invariants

- The LLM never invents content — every claim must trace to a
  retrieved chunk.
- Citation timestamps must point at a real chunk's `startSec`
  within ±30 s tolerance ; anything outside is flagged as a
  hallucinated cite.
- When chunks are empty or off-topic, the LLM must trip a refusal
  pattern (`I don't have evidence in the transcript`, etc.) — no
  fallback to general knowledge.
- Verbatim quotes : every `"..."` span in the answer must appear
  byte-for-byte (case-insensitive) in some chunk's text.

## Data flow

```
chat user question
        │
        ▼
buildCoachingTools(ctx).searchTranscripts({ query })
        │
        ▼
embedText(query)  → 1536-d vector
        │
        ▼
SELECT … FROM transcript_chunks
  WHERE tenant_id = …
    AND 1 - (embedding <=> $vec) >= 0.30
  ORDER BY embedding <=> $vec
  LIMIT 8
        │
        ▼
formatChunksForPrompt → <meeting id="…"> [mm:ss, speaker]: "text" </meeting>
        │
        ▼
LLM (with GROUNDED_SYSTEM_PROMPT) emits answer with [mm:ss] cites
        │
        ▼
parseCitations + splitWithCitations → React render
        │
        ▼
<CitationChip> per token → links to /meetings/<id>?t=<sec>
        │
        ▼
<TranscriptVideoPlayer recordingUrl seekToSec />
        │
        ▼
provider-specific embed (loom / recall / youtube / vimeo / mp4)
        OR external link (zoom / unknown)
```

## Key files

| Concern | File |
|---|---|
| Chunking (transcript → chunks) | `lib/coaching/chunk-transcript.ts` |
| Indexing (embed + insert) | `lib/coaching/index-transcript.ts` |
| Retrieval (ANN + format) | `lib/coaching/retrieve-transcript-chunks.ts` |
| Citation parser | `lib/coaching/citation-parser.ts` |
| Grounded eval helpers | `lib/coaching/grounded-eval.ts` |
| Video URL helpers | `lib/coaching/video-player-url.ts` |
| Chat tool | `lib/chat/tools/coaching.ts` |
| Citation chip | `components/coaching/citation-chip.tsx` |
| Video player | `components/coaching/transcript-video-player.tsx` |
| Format eval suite | `lib/evals/suites/transcript-coaching.eval.ts` |
| Grounded eval suite | `lib/evals/suites/transcript-coaching-grounded.eval.ts` |
| Schema | `db/schema/coaching.ts` (transcript_chunks, signal_url_cache) |
| Cron | `inngest/eval-harness-cron.ts` (Mondays 02:00 UTC) |

## Eval suites

Two distinct suites that catch different regression modes :

### `transcript-coaching` (format)
Validates `formatChunksForPrompt` produces the right input shape :
correct `<meeting id>` tags, `[mm:ss]` markers preserved, verbatim
text passthrough. Pure structural — no LLM call. Runs in <100ms.
Catches : prompt-block schema drift.

### `transcript-coaching-grounded` (LLM-grounded)
Runs the actual LLM against 8 synthetic fixtures :
- 5 grounding cases — LLM must cite the right `[mm:ss]`, quote
  verbatim, score ≥ 0.7 on weighted aggregate (citationAccuracy
  ×0.5 + groundedClaimsRate ×0.3 + verbatim ×0.2).
- 3 refusal cases — empty / off-topic / unsupported-numeric
  questions where LLM must trip a refusal pattern.

Aggregated metrics in `eval_runs.metrics` :
- `pass_rate` — overall (0..1).
- `grounding_pass_rate` — fraction of grounding cases passing.
- `refusal_pass_rate` — fraction of refusal cases passing.
- `mean_citation_accuracy` — across grounding cases.
- `mean_verbatim` — across grounding cases.

Per-case latency lands in `eval_runs.metrics` as well via the
harness aggregation contract.

## Alarms & on-call playbook

### `mean_citation_accuracy` < 0.8

The LLM is mis-citing — pointing at timestamps that don't match a
chunk's start. Common causes :
1. **Prompt drift** — `GROUNDED_SYSTEM_PROMPT` was edited and the
   "preserve [mm:ss] verbatim" rule got softened. Bisect via git
   blame + the prompt versioning column on `eval_runs`.
2. **Chunking shifted** — `chunk-transcript.ts` changed its
   timestamp granularity (e.g. now uses centiseconds), so chunk
   `startSec` no longer matches what the LLM emits. Cross-check
   the eval fixtures' chunk times.
3. **Anthropic model upgraded silently** — pin the model in
   `lib/ai/ai-provider.ts` to a known-good version.

### `refusal_pass_rate` < 0.9

The LLM is hallucinating answers when it should refuse. Common
causes :
1. **Refusal prompt drift** — the system prompt's refusal clause
   was rewritten and the regex doesn't match. Update both prompt
   and `REFUSAL_PATTERNS` in `grounded-eval.ts` together.
2. **Lower-temperature model rolled in** — confidently answers
   without evidence. Inspect a failing case in
   `eval_runs.per_case` (need to add per-case persistence — see
   Open Issues).

### `transcript-coaching-grounded-eval` step errored

The cron's step failed entirely (LLM API outage, rate-limit, etc.).
The other suites still ran — check Inngest dashboard for the run
trace. Re-run manually via `/api/admin/run-eval-suite?suite=
transcript-coaching-grounded` (admin endpoint exists, gated on
admin role).

### Citation accuracy looks fine but UX is broken

Users complain "the chip jumps to the wrong moment in the video".
That's a player issue, not an eval issue.

**Investigate**
1. Check the `meetingId` carried on the chip — does it match the
   chunk's `<meeting id="...">` section in the prompt block ?
2. Inspect the `recordingUrl` shape with `detectProvider(url)` —
   is it being detected correctly ?
3. Loom / YouTube / Vimeo : verify the deep-link param is
   composed with the right key (`t=Ns` for Loom + Recall, `start=N`
   for YouTube, `#t=Ns` for Vimeo).
4. Zoom : the player intentionally falls back to "Open in new tab"
   — Zoom's CDN sets `X-Frame-Options: DENY`. Not a bug, working
   as intended.

## Manual operations

### Re-run a single eval suite

```ts
import { runGroundedCoachingEvalProd } from "@/lib/evals/suites/transcript-coaching-grounded.eval";
const summary = await runGroundedCoachingEvalProd();
console.log(summary);
```

### Pull a tenant's recent eval runs

```sql
SELECT surface_id, prompt_id, cases_passed, cases_total,
       metrics, total_latency_ms, created_at
FROM eval_runs
WHERE surface_id IN ('transcript-coaching', 'transcript-coaching-grounded')
ORDER BY created_at DESC
LIMIT 20;
```

### Reset a tenant's chunks (after a chunking-policy change)

```sql
DELETE FROM transcript_chunks WHERE tenant_id = '...';
```

Then trigger a re-index by re-uploading the transcript through
`/api/meetings/process-transcript` for each affected meeting.

## Adding a new video provider

1. Add a regex to `detectProvider()` in
   `lib/coaching/video-player-url.ts`.
2. Add a `case "<name>":` branch to `buildEmbedUrl()` composing
   the provider's deep-link form.
3. Decide if it's iframe-embeddable or external-link-only — set
   `canEmbed` accordingly.
4. Add the provider to the test matrix in
   `__tests__/video-player-url.test.ts` (5+ cases minimum :
   detection, embed URL, seek-clamp, fragment handling, fallback).
5. Add a render branch to `transcript-video-player.tsx` if the
   provider needs a non-default render shape (rare — most fall
   into "iframe" or "external-link").

No other code paths are needed.

## Test coverage map

| Concern | Test |
|---|---|
| Citation parser | `__tests__/citation-parser.test.ts` |
| Format eval suite | `__tests__/transcript-coaching-eval.test.ts` |
| Grounded eval helpers | `__tests__/grounded-eval.test.ts` |
| Grounded eval suite | `__tests__/transcript-coaching-grounded-eval.test.ts` |
| Video URL helpers | `__tests__/video-player-url.test.ts` |
| Video player component | `components/__tests__/transcript-video-player.test.tsx` |

Total : 100+ tests covering this feature.

## Open issues / future work

- **Per-case eval persistence** — `eval_runs` only stores the
  aggregate. When a regression hits, we know "5 of 8 cases failed"
  but not which 5. Add a sibling table `eval_case_runs(eval_run_id,
  case_id, passed, output_snippet)` so the dashboard can drill
  down. Currently a Sprint-3 audit follow-up that didn't land.
- **Recording-URL persistence** — the player consumes a
  `recordingUrl` prop, but no schema stores it. Recall.ai
  webhooks deliver it ; we need a column on `activities` or a new
  `meeting_recordings` table to persist + serve.
- **Speaker-aware retrieval** — chunks have a `speaker` field,
  but the retrieval doesn't filter by speaker. "What did Sarah
  push back on?" should bias toward Sarah-spoken chunks. Add a
  weak filter in `retrieveTranscriptChunks` when the LLM
  attribute-extracts a speaker name from the question.
- **Prompt-version A/B** — the cron currently runs one prompt
  version per suite. To safely roll new prompts, run both versions
  for a week, compare metrics, ship the winner. Needs a
  `promptVariants` field on `EvalSuite` + a runner that does
  cross-product.
- **Transcript freshness alerts** — when a tenant has 0 chunks for
  >7 days despite scheduled meetings, alert the founder (Recall
  bot probably failed to attach). Currently not surfaced.
- **Multi-tenant fixture support** — the eval fixtures are static
  in code. For tenants with sensitive transcripts where the
  generic fixtures don't reflect the domain, allow per-tenant
  fixture overrides via a `tenants.settings.eval_fixtures` array
  (read-only outside the eval runner).

_Last updated_ : 2026-05-07
