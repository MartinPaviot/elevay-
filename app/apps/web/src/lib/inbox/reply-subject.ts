/**
 * Reply-subject normalization, shared by the server draft pipeline
 * (compose-reply.ts) and the client composer entry points
 * (_conversation-pane.tsx). Pure — safe for both bundles; lives alone so the
 * client never imports compose-reply (whose generator lazy-loads server-only
 * AI/db modules).
 *
 * Audit 2026-07-02, F3: every AI drafting path invented its own subject
 * ("Re: Bonjour", "Re: <first sentence of their email>"), breaking the
 * recipient's threading. A reply's subject is not a model decision — it is
 * `Re: <the thread's literal RFC subject>`, full stop.
 */

/** "Scaling outbound" -> "Re: Scaling outbound"; keeps an existing Re:/RE:/Fwd:/Tr: prefix as-is. */
export function replySubjectFor(threadSubject: string | null | undefined): string {
  const s = (threadSubject ?? "").trim();
  if (!s) return "";
  return /^(re|fwd|fw|tr)\s*:/i.test(s) ? s : `Re: ${s}`;
}
