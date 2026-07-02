-- T10 review fix — the 0116 unique on outbound_email_id alone silently
-- dropped a SECOND low-confidence reply on the same thread after the first
-- entry was resolved. Partial unique on PENDING keeps the Inngest-retry
-- dedup while letting a resolved thread queue again.
DROP INDEX IF EXISTS reply_review_queue_outbound_email_idx;
CREATE UNIQUE INDEX IF NOT EXISTS reply_review_queue_outbound_pending_idx
  ON reply_review_queue (outbound_email_id)
  WHERE state = 'pending';
