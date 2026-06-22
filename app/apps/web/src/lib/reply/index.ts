/**
 * Spec 26 — reply ingest, sentiment + intent classification, action routing.
 * See _specs/26-reply-ingest-sentiment-optout/RECONCILE.md.
 */

export {
  type ReplySource,
  type ReplyEvent,
  type RawEmailReply,
  type RawLinkedInReply,
  ingestEmailReply,
  ingestLinkedInReply,
  ingestReply,
} from "./ingest";

export {
  type Sentiment,
  type Intent,
  type ReplyClassification,
  type ClassifyAgentResult,
  type RunClassifyAgent,
  type ClassifyDeps,
  SENTIMENTS,
  INTENTS,
  classifyReply,
} from "./classify";

export {
  type ReplyAction,
  type ReplyOutcome,
  type ReplyIdempotencyStore,
  type RouteDeps,
  routeReply,
} from "./route";
