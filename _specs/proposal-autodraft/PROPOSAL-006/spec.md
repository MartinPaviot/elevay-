# PROPOSAL-006: PDF support

PDFs do not reflow, so there are two distinct paths (audit + SI-5).

## 006a — Regenerate as PDF (BUILT, zero-dep)
`lib/proposals/pdf.ts renderProposalPdf(components)` produces a clean, paginated,
xref-correct PDF-1.4 (WinAnsi / latin-1 so French accents render). Wired as
`GET /api/proposals/[id]/download?as=pdf` + a "Download PDF" UI link. It works for
ANY filled proposal regardless of source format. **Content-faithful, not
layout-faithful** — it does not preserve a customer's PDF layout. Validated by a
structural test, an independent xref-offset check, and a real sample
(`_artifacts/proposal-sample.pdf`).

## 006b — Fill / ingest a real PDF (needs pdf-lib; Martin's env)
- AcroForm fill: parse the uploaded PDF, set each field's `/V` + appearance,
  flatten (pdf-lib). Forms only.
- PDF ingest: extract text from an uploaded PDF → run the (format-agnostic)
  detection. Needs a PDF text extractor.
Both require `pnpm add pdf-lib` (the no-egress sandbox cannot install it). With the
dep present, add a `sourceFormat='pdf'` ingest path + an AcroForm assembler behind
the existing `DocxFillComponent` interface; the fill + trust layers are unchanged.

## Tasks
1. renderProposalPdf + `?as=pdf` + UI link (DONE).
2. (env) pdf-lib AcroForm fill + PDF text-extract ingest.
