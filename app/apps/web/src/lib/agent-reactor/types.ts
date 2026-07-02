// "email_opened" is deliberately NOT a trigger (T8, founder ban): an open is
// never a decision input — MPP auto-opens make it noise. The reactor also
// hard-skips any in-flight/legacy "email_opened" event before decisioning
// (inngest/agent-reactor.ts), so removing it here can't fall through to the
// LLM.
export type AgentTrigger =
  | "email_replied"
  | "email_bounced"
  | "email_clicked"
  | "signal_detected"
  | "deal_stale"
  | "meeting_completed"
  | "contact_enriched"
  | "sequence_completed"
  | "inbound_email"
  | "deal_stage_changed"
  | "daily_sweep";

export interface AgentReactEventData {
  tenantId: string;
  trigger: AgentTrigger;
  entityType: "contact" | "company" | "deal" | "email";
  entityId: string;
  metadata: Record<string, unknown>;
  deduplicationKey: string;
  firedAt: string;
}

export interface ReactorContext {
  entity: {
    type: string;
    id: string;
    label: string;
    data: Record<string, unknown>;
  };
  recentActivities: Array<{
    type: string;
    summary: string;
    occurredAt: string;
    direction?: string;
    sentiment?: string;
  }>;
  activeSequences: Array<{
    sequenceName: string;
    currentStep: number;
    totalSteps: number;
    status: string;
  }>;
  signals: Array<{
    type: string;
    value: unknown;
  }>;
  pastActions: Array<{
    actionType: string;
    reasoning: string;
    createdAt: string;
    status: string;
  }>;
  workItem: {
    strategy: string;
    nextAction: string | null;
    priority: string;
  } | null;
  icp: {
    industries: string[];
    sizes: string[];
    roles: string[];
    geographies: string[];
  };
  triggerMetadata: Record<string, unknown>;
}

export type AgentActionType =
  | "send_followup"
  | "draft_reply"
  | "advance_deal"
  | "create_task"
  | "create_deal"
  | "enroll_sequence"
  | "alert_founder"
  | "research_company"
  | "enrich_contact"
  | "hold";

export interface AgentDecision {
  actions: AgentDecisionAction[];
  reasoning: string;
  confidence: number;
}

export interface AgentDecisionAction {
  type: AgentActionType;
  params: Record<string, unknown>;
  expectedOutcome: string;
}

// NOTE: the old `email_opened: no actions` entry was the accidental guard
// keeping opens away from the LLM. It is gone because the trigger itself is
// banned — the reactor's hard early-skip (never enters decisioning) is the
// real guard now, not a heuristic that an LLM-available path would bypass.
export const HEURISTIC_DECISIONS: Partial<Record<AgentTrigger, AgentDecision>> = {
  email_bounced: {
    actions: [
      { type: "alert_founder", params: { severity: "high" }, expectedOutcome: "Founder aware of deliverability issue" },
    ],
    reasoning: "Email bounced — alerting founder about deliverability issue",
    confidence: 0.9,
  },
  // NO reflexive CRM mutation. A signal is a reason to prioritise outreach, not
  // an opportunity; a deal is created only when a discovery call is booked and
  // updated only from transcript/email analysis. A stale deal is surfaced to the
  // founder ("À faire"), and a completed meeting is handled by the post-call
  // pipeline — the reactor observes, it does not fire one-shot tasks/deals.
  deal_stale: {
    actions: [],
    reasoning: "Deal stale >7 days — surfaced to the founder; no reflex task.",
    confidence: 0.5,
  },
  signal_detected: {
    actions: [],
    reasoning: "Signal detected — used for prioritisation, not a deal. No reflex action.",
    confidence: 0.5,
  },
  meeting_completed: {
    actions: [],
    reasoning: "Meeting completed — post-call analysis handles CRM updates; no reflex task.",
    confidence: 0.5,
  },
};
