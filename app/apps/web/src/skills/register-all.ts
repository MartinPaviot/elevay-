import { registerSkill } from "./registry";

// Enrichment
import { tamBuilderSkill } from "./enrichment/tam-builder";
import { apolloLeadFinderSkill } from "./enrichment/apollo-lead-finder";
import { companyContactFinderSkill } from "./enrichment/company-contact-finder";
import { inboundLeadEnrichmentSkill } from "./enrichment/inbound-lead-enrichment";

// Outreach
import { coldEmailOutreachSkill } from "./outreach/cold-email-outreach";
import { emailDraftingSkill } from "./outreach/email-drafting";

// Scoring
import { leadQualificationSkill } from "./scoring/lead-qualification";
import { icpIdentificationSkill } from "./scoring/icp-identification";
import { inboundLeadQualificationSkill } from "./scoring/inbound-lead-qualification";

// Signals
import { signalScannerSkill } from "./signals/signal-scanner";
import { contactCacheSkill } from "./signals/contact-cache";

// Intelligence
import { meetingBriefSkill } from "./intelligence/meeting-brief";
import { pipelineReviewSkill } from "./intelligence/pipeline-review";
import { sequencePerformanceSkill } from "./intelligence/sequence-performance";
import { salesCoachingSkill } from "./intelligence/sales-coaching";
import { salesCallPrepSkill } from "./intelligence/sales-call-prep";
import { battlecardGeneratorSkill } from "./intelligence/battlecard-generator";
import { competitorIntelSkill } from "./intelligence/competitor-intel";
import { churnRiskDetectorSkill } from "./intelligence/churn-risk-detector";

export function registerAllSkills() {
  registerSkill(tamBuilderSkill);
  registerSkill(apolloLeadFinderSkill);
  registerSkill(companyContactFinderSkill);
  registerSkill(inboundLeadEnrichmentSkill);
  registerSkill(coldEmailOutreachSkill);
  registerSkill(emailDraftingSkill);
  registerSkill(leadQualificationSkill);
  registerSkill(icpIdentificationSkill);
  registerSkill(inboundLeadQualificationSkill);
  registerSkill(signalScannerSkill);
  registerSkill(contactCacheSkill);
  registerSkill(meetingBriefSkill);
  registerSkill(pipelineReviewSkill);
  registerSkill(sequencePerformanceSkill);
  registerSkill(salesCoachingSkill);
  registerSkill(salesCallPrepSkill);
  registerSkill(battlecardGeneratorSkill);
  registerSkill(competitorIntelSkill);
  registerSkill(churnRiskDetectorSkill);
}
