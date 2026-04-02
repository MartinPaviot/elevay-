import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acceptable Use Policy | LeadSens",
  description: "LeadSens Acceptable Use Policy",
};

export default function AcceptableUsePage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
        Acceptable Use Policy
      </h1>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        Last updated: April 1, 2026
      </p>

      <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
        {/* 1. Overview */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            1. Overview
          </h2>
          <p className="mt-3">
            This Acceptable Use Policy (&quot;AUP&quot;) defines the rules and guidelines for
            using LeadSens, operated by Elevay. This policy is incorporated into and
            forms part of our{" "}
            <a href="/terms" className="text-[var(--color-accent)] hover:underline">
              Terms of Service
            </a>
            .
          </p>
          <p className="mt-2">
            Violations of this policy may result in warnings, temporary suspension, or
            permanent termination of your account, at our sole discretion.
          </p>
        </section>

        {/* 2. Prohibited Content */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            2. Prohibited Content in Outbound Emails
          </h2>
          <p className="mt-3">
            You may not use LeadSens to send emails that contain or promote:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Spam, unsolicited bulk messages, or any content sent without proper consent or legal basis</li>
            <li>Malware, viruses, phishing links, or any harmful software</li>
            <li>Fraudulent or deceptive content, including misleading subject lines or sender impersonation</li>
            <li>Illegal products or services</li>
            <li>Harassment, threats, hate speech, or discriminatory content</li>
            <li>Content that infringes on intellectual property rights of third parties</li>
            <li>Adult, pornographic, or sexually explicit material</li>
            <li>Gambling or cryptocurrency promotions (unless properly licensed)</li>
            <li>Fake or misleading unsubscribe mechanisms</li>
            <li>Content designed to circumvent email filters or deliverability controls</li>
          </ul>
        </section>

        {/* 3. Anti-Spam Requirements */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            3. Anti-Spam Requirements
          </h2>
          <p className="mt-3">
            All outbound emails sent through LeadSens must comply with the following:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Proper identification:</strong> Emails must clearly identify you
              or your organization as the sender. Do not use false or misleading header
              information.
            </li>
            <li>
              <strong>Accurate subject lines:</strong> Subject lines must accurately
              reflect the content of the email.
            </li>
            <li>
              <strong>Working unsubscribe:</strong> Every outbound email must include a
              functional unsubscribe link. LeadSens automatically includes one, and you
              must not remove or obscure it.
            </li>
            <li>
              <strong>Honor opt-outs:</strong> Unsubscribe requests must be processed
              within 10 business days. LeadSens automatically handles opt-outs, but you
              must not re-add opted-out contacts to sequences.
            </li>
            <li>
              <strong>Physical address:</strong> Commercial emails must include a valid
              physical postal address of the sender.
            </li>
            <li>
              <strong>Legal basis for contact:</strong> You must have a legitimate
              reason to contact each recipient (e.g., prior business relationship,
              consent, or legitimate interest under GDPR).
            </li>
          </ul>
        </section>

        {/* 4. Volume Limits */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            4. Volume Limits and Sending Practices
          </h2>
          <p className="mt-3">
            To maintain high deliverability and protect all users:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Daily limits:</strong> Each connected mailbox has a configurable
              daily sending limit. New mailboxes start with a warm-up period with
              reduced limits.
            </li>
            <li>
              <strong>Bounce rate:</strong> Your bounce rate must remain below 5%. If
              it exceeds this threshold, your sending may be automatically paused.
            </li>
            <li>
              <strong>Spam complaint rate:</strong> Your spam complaint rate must remain
              below 0.1%. Exceeding this threshold may result in immediate suspension
              of outbound sending.
            </li>
            <li>
              <strong>List hygiene:</strong> You are responsible for maintaining clean
              contact lists. Do not upload purchased lists of unknown provenance.
            </li>
            <li>
              <strong>Warm-up compliance:</strong> New mailboxes must complete the
              warm-up process. Do not attempt to bypass warm-up limits.
            </li>
          </ul>
        </section>

        {/* 5. Regulatory Compliance */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            5. Regulatory Compliance
          </h2>
          <p className="mt-3">
            You are responsible for ensuring your use of LeadSens complies with all
            applicable laws and regulations, including but not limited to:
          </p>

          <h3 className="mt-4 text-lg font-medium text-[var(--color-text-primary)]">
            5.1 GDPR (EU/EEA)
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Ensure you have a valid legal basis for processing personal data of EU/EEA residents</li>
            <li>Honor data subject requests (access, rectification, erasure, portability)</li>
            <li>Maintain records of processing activities where required</li>
            <li>Report data breaches to us immediately so we can fulfill our notification obligations</li>
          </ul>

          <h3 className="mt-4 text-lg font-medium text-[var(--color-text-primary)]">
            5.2 CAN-SPAM Act (United States)
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Do not use false or misleading header information</li>
            <li>Do not use deceptive subject lines</li>
            <li>Identify commercial messages as advertisements where required</li>
            <li>Include your valid physical postal address</li>
            <li>Honor opt-out requests within 10 business days</li>
          </ul>

          <h3 className="mt-4 text-lg font-medium text-[var(--color-text-primary)]">
            5.3 CASL (Canada)
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Obtain express or implied consent before sending commercial electronic messages to Canadian recipients</li>
            <li>Include proper sender identification and contact information</li>
            <li>Provide a functional unsubscribe mechanism</li>
          </ul>
        </section>

        {/* 6. Prohibited Activities */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            6. General Prohibited Activities
          </h2>
          <p className="mt-3">
            In addition to email-specific rules, you may not use LeadSens to:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Attempt to gain unauthorized access to the Service, other accounts, or related systems</li>
            <li>Reverse-engineer, decompile, or extract the source code of the Service</li>
            <li>Interfere with or disrupt the integrity or performance of the Service</li>
            <li>Use the Service to compete with LeadSens or build a competing product</li>
            <li>Share account credentials or allow unauthorized third parties to access your account</li>
            <li>Use automated tools (bots, scrapers) to access the Service beyond the provided APIs</li>
            <li>Store or process data that you do not have the right to use</li>
            <li>Circumvent any security measures, rate limits, or usage restrictions</li>
          </ul>
        </section>

        {/* 7. Account Suspension */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            7. Enforcement and Account Suspension
          </h2>
          <p className="mt-3">
            Violations of this AUP may result in the following actions, at our
            discretion:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Warning:</strong> For first-time minor violations, we may issue a
              written warning with a deadline to remedy the violation.
            </li>
            <li>
              <strong>Feature restriction:</strong> We may disable specific features
              (e.g., outbound email sending) while the violation is investigated.
            </li>
            <li>
              <strong>Temporary suspension:</strong> Your account may be suspended for
              up to 30 days while we investigate the violation. You will be notified
              via email.
            </li>
            <li>
              <strong>Permanent termination:</strong> For severe or repeated violations,
              we may permanently terminate your account and delete your data after the
              30-day export window.
            </li>
          </ul>
          <p className="mt-3">
            We will make reasonable efforts to notify you before or promptly after
            taking enforcement action, except where immediate action is necessary to
            protect other users or the integrity of the Service.
          </p>
        </section>

        {/* 8. Reporting Violations */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            8. Reporting Violations
          </h2>
          <p className="mt-3">
            If you believe a LeadSens user is violating this AUP, please report it to:
          </p>
          <ul className="mt-2 list-none space-y-1 pl-0">
            <li>
              <strong>Email:</strong> abuse@elevay.dev
            </li>
          </ul>
          <p className="mt-2">
            Include as much detail as possible, including the sender email address,
            date/time, and content of any offending messages.
          </p>
        </section>

        {/* 9. Contact */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            9. Contact
          </h2>
          <p className="mt-3">
            For questions about this Acceptable Use Policy, contact us at:
          </p>
          <ul className="mt-2 list-none space-y-1 pl-0">
            <li>
              <strong>Email:</strong> legal@elevay.dev
            </li>
            <li>
              <strong>Company:</strong> Elevay
            </li>
            <li>
              <strong>Country:</strong> France
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
