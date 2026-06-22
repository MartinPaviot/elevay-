/**
 * Spec 26 (AC1) — normalize provider reply webhooks (email port 23 / LinkedIn
 * port 24) to a canonical `ReplyEvent`. Pure; the webhook auth + HTTP live in the
 * route. Blast radius: reply/* only.
 */

export type ReplySource = "email" | "linkedin";

export interface ReplyEvent {
  /** Provider message id — the idempotency key (AC5). */
  providerMessageId: string;
  source: ReplySource;
  contactId: string;
  enrollmentId?: string;
  fromEmail?: string;
  fromProfileUrl?: string;
  text: string;
  receivedAt: number;
  threadId?: string;
}

export interface RawEmailReply {
  message_id: string;
  contact_id: string;
  enrollment_id?: string;
  from_email?: string;
  body_text?: string;
  body?: string;
  received_at?: number;
  thread_id?: string;
}

export interface RawLinkedInReply {
  message_id: string;
  contact_id: string;
  enrollment_id?: string;
  profile_url?: string;
  text?: string;
  received_at?: number;
}

function nowOr(ts?: number): number {
  return typeof ts === "number" && Number.isFinite(ts) ? ts : Date.now();
}

export function ingestEmailReply(raw: RawEmailReply): ReplyEvent {
  return {
    providerMessageId: raw.message_id,
    source: "email",
    contactId: raw.contact_id,
    enrollmentId: raw.enrollment_id,
    fromEmail: raw.from_email?.trim().toLowerCase(),
    text: (raw.body_text ?? raw.body ?? "").trim(),
    receivedAt: nowOr(raw.received_at),
    threadId: raw.thread_id,
  };
}

export function ingestLinkedInReply(raw: RawLinkedInReply): ReplyEvent {
  return {
    providerMessageId: raw.message_id,
    source: "linkedin",
    contactId: raw.contact_id,
    enrollmentId: raw.enrollment_id,
    fromProfileUrl: raw.profile_url?.trim(),
    text: (raw.text ?? "").trim(),
    receivedAt: nowOr(raw.received_at),
  };
}

/** Normalize either provider's raw payload to a canonical reply event. */
export function ingestReply(raw: RawEmailReply | RawLinkedInReply, source: ReplySource): ReplyEvent {
  return source === "email" ? ingestEmailReply(raw as RawEmailReply) : ingestLinkedInReply(raw as RawLinkedInReply);
}
