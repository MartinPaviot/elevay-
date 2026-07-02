import { withAuthRLS } from "@/lib/auth/auth-utils";
import { db } from "@/db";
import { contacts, companies } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { hasInboundEmailFrom } from "@/lib/guardrails/sending-gate";
import { runTransportContentQc } from "@/lib/emails/transport-content-qc";
import { decideFabricationGate } from "@/lib/evals/fabrication-gate";
import {
  readCachedBrief,
  toResearchBriefContext,
} from "@/lib/campaign-engine/build-intelligence-brief";

/**
 * `POST /api/send/pregate` — M13-R8 (T4): manual sends pass G2 (factual) +
 * G5 (deliverability content) BEFORE the wire, with the failing check
 * explained so the founder edits instead of discovering a blocked send.
 *
 * - A REPLY (recipient has actually written to us — verified server-side,
 *   same rule as the transport gate) is not content-gated: answering a
 *   correspondent is not prospecting.
 * - G5 reuses the exact transport profile (transport-content-qc) — what
 *   passes here passes at the wire.
 * - G2 is the DETERMINISTIC fabrication layer (pure, no LLM — p95 well under
 *   the 2,5 s budget): with no cached research brief, any hard specific
 *   (counts, named tech, ALLCAPS+year events) about the prospect is
 *   unverifiable by construction and blocks with the offending tokens. When
 *   a cached brief exists, its facts are the ground truth and real numbers
 *   are not second-guessed. The SEMANTIC judge stays a generation-time
 *   concern (T6b) — this endpoint never calls an LLM.
 *
 * This endpoint only EXPLAINS; the transport gate remains the enforcement
 * (evaluateSend re-checks G5 + suppression + cap at T-0). No bypass exists:
 * skipping the pregate only means discovering the block at send time.
 */
export async function POST(req: Request) {
  return withAuthRLS(async (authCtx) => {
    let input: {
      to?: string;
      subject?: string;
      body?: string;
      contactId?: string | null;
      skipUnsubscribe?: boolean;
    };
    try {
      input = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const to = (input.to ?? "").trim();
    const body = (input.body ?? "").trim();
    if (!to || !body) {
      return Response.json({ error: "`to` and `body` are required" }, { status: 400 });
    }

    // Server-side class resolution — same semantics as the transport gate.
    let isReply = false;
    try {
      isReply = await hasInboundEmailFrom(authCtx.tenantId, to);
    } catch {
      isReply = false; // unverifiable -> treated as outreach (stricter)
    }
    if (isReply) {
      return Response.json({ allowed: true, sendClass: "reply", failures: [] });
    }

    const failures: Array<{ gate: 2 | 5; code: string; detail: string }> = [];

    // ── G5 — deliverability content (transport profile) ──
    const g5 = runTransportContentQc({
      subject: input.subject,
      bodyText: body,
      // The interactive path (deliver-interactive) attaches the
      // List-Unsubscribe header unless the caller opts out.
      unsubscribeProvided: !input.skipUnsubscribe,
    });
    for (const f of g5.failures) {
      failures.push({
        gate: 5,
        code: f,
        detail: f.startsWith("spam:")
          ? `Spam signals detected (${f.slice(5)}) — rephrase before sending.`
          : f.startsWith("links:")
            ? "Too many links for a first touch — keep at most 3."
            : "No unsubscribe mechanism — keep the standard footer or add an opt-out mention.",
      });
    }

    // ── G2 — factual verification (deterministic layer) ──
    // Prospect context + cached research brief (fail-soft: no brief = the
    // strict empty-brief rule applies, which is exactly the intent).
    let prospect: { name?: string | null; title?: string | null; company?: string | null; domain?: string | null } = {};
    let brief;
    if (input.contactId) {
      try {
        const [row] = await db
          .select({
            firstName: contacts.firstName,
            lastName: contacts.lastName,
            title: contacts.title,
            companyId: contacts.companyId,
            companyName: companies.name,
            companyDomain: companies.domain,
          })
          .from(contacts)
          .leftJoin(companies, eq(contacts.companyId, companies.id))
          .where(and(eq(contacts.tenantId, authCtx.tenantId), eq(contacts.id, input.contactId)))
          .limit(1);
        if (row) {
          prospect = {
            name: [row.firstName, row.lastName].filter(Boolean).join(" ") || null,
            title: row.title,
            company: row.companyName,
            domain: row.companyDomain,
          };
          if (row.companyId) {
            const cached = await readCachedBrief(authCtx.tenantId, row.companyId, input.contactId);
            if (cached) brief = toResearchBriefContext(cached);
          }
        }
      } catch {
        // fail-soft: prospect/brief unavailable -> strictest G2 posture
      }
    }
    const g2 = decideFabricationGate({ body, brief, prospect });
    if (g2.blocked) {
      failures.push({
        gate: 2,
        code: "fabrication",
        detail: `Unverifiable claim(s) about this prospect: ${g2.ungrounded.join(", ")} — we hold no data supporting them. Remove or rephrase.`,
      });
    }

    return Response.json({
      allowed: failures.length === 0,
      sendClass: "outreach",
      failures,
    });
  });
}
