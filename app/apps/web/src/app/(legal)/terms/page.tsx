import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Elevay",
  description: "Elevay Terms of Service",
};

export default function TermsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        Last updated: April 1, 2026
      </p>

      <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
        {/* 1. Introduction */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            1. Introduction
          </h2>
          <p className="mt-3">
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of
            Elevay, a SaaS platform operated by Elevay (&quot;Company&quot;, &quot;we&quot;,
            &quot;us&quot;, or &quot;our&quot;), a company registered in France, accessible at
            elevay.dev and related domains.
          </p>
          <p className="mt-2">
            By creating an account or using Elevay, you agree to be bound by these
            Terms. If you do not agree, do not use the Service.
          </p>
        </section>

        {/* 2. Service Description */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            2. Service Description
          </h2>
          <p className="mt-3">
            Elevay is an AI-powered go-to-market (GTM) platform that provides:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Customer relationship management (CRM) for contacts, companies, and deals</li>
            <li>Automated outbound email sequences and deliverability management</li>
            <li>AI-assisted lead scoring, enrichment, and prioritization</li>
            <li>Pipeline analytics, deal coaching, and business intelligence</li>
            <li>Automatic capture and summarization of customer interactions</li>
            <li>Natural language querying of your sales data</li>
          </ul>
        </section>

        {/* 3. Account Registration */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            3. Account Registration
          </h2>
          <p className="mt-3">
            You must provide accurate, complete information when creating an account.
            You are responsible for safeguarding your credentials and for all activity
            that occurs under your account. You must notify us immediately of any
            unauthorized use.
          </p>
          <p className="mt-2">
            You must be at least 18 years old and have the legal authority to bind the
            entity on whose behalf you are using the Service.
          </p>
        </section>

        {/* 4. User Obligations */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            4. User Obligations
          </h2>
          <p className="mt-3">You agree to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Use the Service only for lawful purposes and in compliance with all applicable laws</li>
            <li>Maintain the accuracy of your account information</li>
            <li>Obtain all necessary consents before uploading personal data of third parties</li>
            <li>Comply with all applicable anti-spam and data protection regulations (including GDPR, CAN-SPAM, and CASL) when sending outbound emails</li>
            <li>Not share your account credentials with unauthorized third parties</li>
            <li>Comply with our Acceptable Use Policy</li>
          </ul>
        </section>

        {/* 5. Acceptable Use */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            5. Acceptable Use
          </h2>
          <p className="mt-3">
            Your use of the Service is subject to our{" "}
            <a href="/acceptable-use" className="text-[var(--color-accent)] hover:underline">
              Acceptable Use Policy
            </a>
            , which is incorporated into these Terms by reference. Violations may
            result in immediate suspension or termination of your account.
          </p>
        </section>

        {/* 6. Payment Terms */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            6. Payment Terms
          </h2>
          <p className="mt-3">
            Elevay offers subscription-based plans. Payments are processed through
            Stripe. By subscribing, you agree to:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Pay all fees associated with your selected plan</li>
            <li>Subscriptions renew automatically at the end of each billing period unless cancelled</li>
            <li>Price changes will be communicated at least 30 days in advance</li>
            <li>Refunds are available within 14 days of initial purchase if you have not substantially used the Service</li>
            <li>Failure to pay may result in suspension or termination of your account</li>
            <li>All prices are exclusive of applicable taxes unless stated otherwise</li>
          </ul>
          <p className="mt-2">
            Free trial periods, if offered, convert to paid subscriptions at the end
            of the trial unless cancelled before the trial expires.
          </p>
        </section>

        {/* 7. Data Ownership */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            7. Data Ownership
          </h2>
          <p className="mt-3">
            <strong>You own your data.</strong> All content, contacts, companies, deals,
            emails, notes, and other data you upload or create within Elevay
            (&quot;Customer Data&quot;) remains your property. We do not claim any ownership
            rights over your Customer Data.
          </p>
          <p className="mt-2">
            You grant us a limited license to process your Customer Data solely for
            the purpose of providing, maintaining, and improving the Service. This
            license terminates when you delete your data or close your account.
          </p>
          <p className="mt-2">
            You may export all your data at any time via the GDPR data export feature
            or by contacting us at privacy@elevay.dev.
          </p>
        </section>

        {/* 8. AI Usage Disclaimer */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            8. AI Usage Disclaimer
          </h2>
          <p className="mt-3">
            Elevay uses artificial intelligence and large language models (LLMs) to
            provide features such as lead scoring, email generation, deal coaching,
            data enrichment, and natural language querying.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              AI-generated content (including email drafts, summaries, and scores) is
              provided as suggestions and should be reviewed before use
            </li>
            <li>
              We do not guarantee the accuracy, completeness, or suitability of any
              AI-generated output
            </li>
            <li>
              Your Customer Data may be sent to third-party AI providers (such as
              Anthropic and OpenAI) for processing; see our Privacy Policy for details
            </li>
            <li>
              You are solely responsible for reviewing and approving any AI-generated
              content before it is sent to third parties (e.g., outbound emails)
            </li>
            <li>
              AI models may produce inaccurate or biased results; use professional
              judgment when acting on AI recommendations
            </li>
          </ul>
        </section>

        {/* 9. Intellectual Property */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            9. Intellectual Property
          </h2>
          <p className="mt-3">
            The Service, including its software, design, logos, and documentation, is
            the intellectual property of Elevay and is protected by applicable
            intellectual property laws. You may not copy, modify, distribute,
            reverse-engineer, or create derivative works of the Service.
          </p>
        </section>

        {/* 10. Limitation of Liability */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            10. Limitation of Liability
          </h2>
          <p className="mt-3">
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES
              OF ANY KIND, WHETHER EXPRESS OR IMPLIED
            </li>
            <li>
              WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
              CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA,
              OR BUSINESS OPPORTUNITIES
            </li>
            <li>
              OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID TO US IN THE
              12 MONTHS PRECEDING THE CLAIM
            </li>
            <li>
              WE ARE NOT LIABLE FOR DAMAGES ARISING FROM YOUR USE OF AI-GENERATED
              CONTENT, THIRD-PARTY INTEGRATIONS, OR EMAIL DELIVERABILITY ISSUES
            </li>
          </ul>
        </section>

        {/* 11. Indemnification */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            11. Indemnification
          </h2>
          <p className="mt-3">
            You agree to indemnify and hold harmless Elevay and its officers,
            directors, employees, and agents from any claims, losses, or damages
            (including legal fees) arising from your use of the Service, your
            violation of these Terms, or your violation of any third-party rights
            (including anti-spam laws and data protection regulations).
          </p>
        </section>

        {/* 12. Termination */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            12. Termination
          </h2>
          <p className="mt-3">
            Either party may terminate this agreement at any time:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <strong>By you:</strong> Cancel your subscription and delete your
              account at any time from your account settings or by contacting us
            </li>
            <li>
              <strong>By us:</strong> We may suspend or terminate your account if you
              breach these Terms, the Acceptable Use Policy, or fail to pay
              subscription fees
            </li>
          </ul>
          <p className="mt-2">
            Upon termination, you may request an export of your data within 30 days.
            After 30 days, we may delete all your data in accordance with our data
            retention policies.
          </p>
        </section>

        {/* 13. Changes to Terms */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            13. Changes to Terms
          </h2>
          <p className="mt-3">
            We may update these Terms from time to time. We will notify you of
            material changes at least 30 days in advance via email or in-app
            notification. Continued use of the Service after the effective date
            constitutes acceptance of the updated Terms.
          </p>
        </section>

        {/* 14. Governing Law */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            14. Governing Law &amp; Dispute Resolution
          </h2>
          <p className="mt-3">
            These Terms are governed by and construed in accordance with the laws of
            France. Any disputes arising from these Terms or your use of the Service
            shall be subject to the exclusive jurisdiction of the courts of Paris,
            France.
          </p>
          <p className="mt-2">
            Before initiating legal proceedings, both parties agree to attempt to
            resolve disputes through good-faith negotiation for a period of at least
            30 days.
          </p>
        </section>

        {/* 15. Contact */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            15. Contact
          </h2>
          <p className="mt-3">
            For questions about these Terms, contact us at:
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
