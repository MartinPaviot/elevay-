# 18 — meeting-upload (`/meetings/upload`) — audit d'hydratation

**Verdict global : H1 (fidèle).** This is a user-action-driven upload form, not a data dashboard, so it has no on-mount tenant-data fetch to hydrate. Every data-bearing element (matched-contact count, meeting-notes summary) is rendered only after submission from the real, auth-gated, tenant-scoped /api/meetings/upload-transcript -> /api/meetings/process-transcript pipeline, with a loading state (button spinner/Processing…), conditional empty guards, and error degradation via toast. Verdict: faithful (H1); the remaining elements are correctly-static form chrome (H0).

Entrée : `app/apps/web/src/app/(dashboard)/meetings/upload/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Page intro / instructions copy | app/apps/web/src/app/(dashboard)/meetings/upload/page.tsx:86-89 | static (hardcoded copy) | H0 | n/a | n/a | n/a | n/a | static | Pure chrome — instructional copy on an input form; correctly static. |
| Form inputs (title, transcript textarea, file picker) + char count | app/apps/web/src/app/(dashboard)/meetings/upload/page.tsx:95-143 | local component state (useState title/text/file), char count = text.trim().length:117 | H0 | n/a | n/a | n/a | n/a | static | Local form state, not server data. Char count reflects live input. Faithful for an input form. |
| Result banner — "Transcript processed" + matched-contacts count | app/apps/web/src/app/(dashboard)/meetings/upload/page.tsx:155-165 (count derived 63-67) | POST /api/meetings/upload-transcript -> /api/meetings/process-transcript; matchedContacts built tenant-scoped from contacts (eq contacts.tenantId authCtx.tenantId) at process-transcript/route.ts:79-123,308 | H1 | yes | spinner | handled | global | once | Faithful: count comes from real tenant-scoped contact matching against the submitted transcript. matchedCount>0 guards an empty count line; submit button shows loading; failures surface via toast (lines 44,51). |
| Result — Meeting notes summary (ChatMarkdown) | app/apps/web/src/app/(dashboard)/meetings/upload/page.tsx:166-175 (summary derived 57-62) | result.notes.summary from process-transcript LLM extraction (notes-schema), returned at process-transcript/route.ts:307; relayed by upload-transcript/route.ts:147 | H1 | yes | spinner | handled | global | once | Faithful: real LLM-generated summary of the submitted transcript, rendered only when present (summary && ...). Auth-gated (getAuthContext) and tenant-scoped pipeline. |

## Pires défauts

1. No real defect found. Minor: a server-side processing failure returns a generic toast "Upload failed." with no per-field/error-region detail (page.tsx:44), but error is handled, not silent.
