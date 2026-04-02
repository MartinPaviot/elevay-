import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | LeadSens",
  description: "LeadSens Privacy Policy - GDPR compliant",
};

export default function PrivacyPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        Last updated: April 1, 2026
      </p>

      <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
        {/* 1. Data Controller */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            1. Data Controller
          </h2>
          <p className="mt-3">
            The data controller for personal data processed through LeadSens is:
          </p>
          <ul className="mt-2 list-none space-y-1 pl-0">
            <li>
              <strong>Company:</strong> Elevay
            </li>
            <li>
              <strong>Country:</strong> France
            </li>
            <li>
              <strong>Email:</strong> privacy@elevay.dev
            </li>
            <li>
              <strong>Data Protection Officer:</strong> privacy@elevay.dev
            </li>
          </ul>
          <p className="mt-2">
            This Privacy Policy explains how we collect, use, store, and protect your
            personal data when you use LeadSens in compliance with the General Data
            Protection Regulation (GDPR), the French Data Protection Act (Loi
            Informatique et Libert&eacute;s), and other applicable data protection laws.
          </p>
        </section>

        {/* 2. Data We Collect */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            2. Data We Collect
          </h2>

          <h3 className="mt-4 text-lg font-medium text-[var(--color-text-primary)]">
            2.1 Account Data
          </h3>
          <p className="mt-2">
            When you create an account, we collect:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Name and email address</li>
            <li>Authentication credentials (via Google OAuth or email/password)</li>
            <li>Profile picture (if provided via Google)</li>
            <li>Company/organization name</li>
          </ul>

          <h3 className="mt-4 text-lg font-medium text-[var(--color-text-primary)]">
            2.2 Customer Data (CRM Data)
          </h3>
          <p className="mt-2">
            Data you upload or create within the Service:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Contact information (names, emails, phone numbers, job titles, LinkedIn URLs)</li>
            <li>Company information (names, domains, industry, size, revenue)</li>
            <li>Deal/opportunity data (names, stages, values, notes)</li>
            <li>Email content (sent and received through connected mailboxes)</li>
            <li>Notes, tasks, and meeting records</li>
            <li>Outbound email sequences and templates</li>
            <li>Chat conversations with the AI assistant</li>
          </ul>

          <h3 className="mt-4 text-lg font-medium text-[var(--color-text-primary)]">
            2.3 Usage Data
          </h3>
          <p className="mt-2">
            We automatically collect:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Pages visited, features used, and actions taken within the Service</li>
            <li>Browser type, operating system, and device information</li>
            <li>IP address and approximate location</li>
            <li>Timestamps and session duration</li>
            <li>Error logs and performance data</li>
          </ul>

          <h3 className="mt-4 text-lg font-medium text-[var(--color-text-primary)]">
            2.4 Enrichment Data
          </h3>
          <p className="mt-2">
            When you use our data enrichment features, we may retrieve additional
            information about your contacts and companies from third-party data
            providers, including:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Company firmographic data (industry, employee count, revenue, funding)</li>
            <li>Contact professional data (job title, department, seniority)</li>
            <li>Social media profiles and public web data</li>
          </ul>
        </section>

        {/* 3. How We Process Data */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            3. How We Process Data
          </h2>

          <h3 className="mt-4 text-lg font-medium text-[var(--color-text-primary)]">
            3.1 Core Service Delivery
          </h3>
          <p className="mt-2">
            We process your data to provide the CRM, email sequencing, pipeline
            management, and analytics features of the Service.
          </p>

          <h3 className="mt-4 text-lg font-medium text-[var(--color-text-primary)]">
            3.2 AI and LLM Processing
          </h3>
          <p className="mt-2">
            LeadSens uses artificial intelligence to provide features such as:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <strong>Email generation and suggestions:</strong> Your contact data and
              context may be sent to AI providers to generate email drafts
            </li>
            <li>
              <strong>Lead scoring and prioritization:</strong> Contact and company data
              is analyzed by AI models to calculate engagement scores
            </li>
            <li>
              <strong>Deal coaching and intelligence:</strong> Deal history and
              interaction data may be processed by AI to provide recommendations
            </li>
            <li>
              <strong>Natural language querying:</strong> Your questions and relevant CRM
              data are processed to generate answers with citations
            </li>
            <li>
              <strong>Automatic summarization:</strong> Meeting notes, emails, and
              activity history may be summarized by AI
            </li>
          </ul>
          <p className="mt-2">
            When data is sent to third-party AI providers, we minimize the data
            transmitted to only what is necessary for the specific feature. We do not
            allow AI providers to use your data for training their models.
          </p>

          <h3 className="mt-4 text-lg font-medium text-[var(--color-text-primary)]">
            3.3 Data Enrichment
          </h3>
          <p className="mt-2">
            Company domains and contact email addresses may be sent to enrichment APIs
            to retrieve publicly available business information. This processing
            occurs only when you actively trigger an enrichment action.
          </p>
        </section>

        {/* 4. Legal Basis */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            4. Legal Basis for Processing
          </h2>
          <p className="mt-3">
            Under GDPR, we process personal data on the following legal bases:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Performance of contract (Art. 6(1)(b)):</strong> Processing
              necessary to provide the Service as described in our Terms of Service,
              including CRM functionality, email sending, and AI features.
            </li>
            <li>
              <strong>Legitimate interest (Art. 6(1)(f)):</strong> Processing for
              security, fraud prevention, service improvement, and analytics, where
              our interests do not override your fundamental rights.
            </li>
            <li>
              <strong>Consent (Art. 6(1)(a)):</strong> Where we process data based on
              your explicit consent (e.g., optional enrichment features, marketing
              communications). You may withdraw consent at any time.
            </li>
            <li>
              <strong>Legal obligation (Art. 6(1)(c)):</strong> Processing required to
              comply with applicable laws, such as financial record-keeping.
            </li>
          </ul>
        </section>

        {/* 5. Data Retention */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            5. Data Retention
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              <strong>Account data:</strong> Retained for the duration of your account
              plus 30 days after deletion to allow for recovery.
            </li>
            <li>
              <strong>Customer Data (CRM):</strong> Retained for the duration of your
              account. Deleted within 30 days of account closure or upon GDPR deletion
              request.
            </li>
            <li>
              <strong>Usage and analytics data:</strong> Retained in anonymized form for
              up to 24 months for service improvement.
            </li>
            <li>
              <strong>Email opt-out records:</strong> Retained indefinitely to ensure
              ongoing compliance with unsubscribe requests.
            </li>
            <li>
              <strong>Billing records:</strong> Retained for 10 years as required by
              French commercial law.
            </li>
          </ul>
        </section>

        {/* 6. Your Rights */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            6. Your Rights Under GDPR
          </h2>
          <p className="mt-3">
            As a data subject, you have the following rights:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Right of access (Art. 15):</strong> Request a copy of all personal
              data we hold about you. You can use the data export feature in your
              account settings or contact us.
            </li>
            <li>
              <strong>Right to rectification (Art. 16):</strong> Request correction of
              inaccurate personal data. You can edit most data directly within the
              Service.
            </li>
            <li>
              <strong>Right to erasure (Art. 17):</strong> Request deletion of your
              personal data. You can use the account deletion feature or contact us.
              We will delete your data within 30 days, subject to legal retention
              obligations.
            </li>
            <li>
              <strong>Right to data portability (Art. 20):</strong> Receive your data in
              a structured, commonly used, machine-readable format (JSON). Available via
              the data export API endpoint.
            </li>
            <li>
              <strong>Right to restriction (Art. 18):</strong> Request that we restrict
              processing of your data in certain circumstances.
            </li>
            <li>
              <strong>Right to object (Art. 21):</strong> Object to processing based on
              legitimate interest, including profiling and automated decision-making.
            </li>
            <li>
              <strong>Right to withdraw consent:</strong> Where processing is based on
              consent, you may withdraw it at any time without affecting the lawfulness
              of prior processing.
            </li>
            <li>
              <strong>Right to lodge a complaint:</strong> You have the right to lodge a
              complaint with the French data protection authority (CNIL) or your local
              supervisory authority.
            </li>
          </ul>
          <p className="mt-3">
            To exercise any of these rights, contact us at{" "}
            <strong>privacy@elevay.dev</strong>. We will respond within 30 days.
          </p>
        </section>

        {/* 7. Sub-processors */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            7. Sub-processors
          </h2>
          <p className="mt-3">
            We use the following third-party sub-processors to deliver the Service:
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border-default)]">
                  <th className="pb-2 pr-4 font-medium text-[var(--color-text-primary)]">
                    Provider
                  </th>
                  <th className="pb-2 pr-4 font-medium text-[var(--color-text-primary)]">
                    Purpose
                  </th>
                  <th className="pb-2 font-medium text-[var(--color-text-primary)]">
                    Location
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-default)]">
                <tr>
                  <td className="py-2 pr-4">Supabase (PostgreSQL)</td>
                  <td className="py-2 pr-4">Database hosting and storage</td>
                  <td className="py-2">EU (Frankfurt)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Vercel</td>
                  <td className="py-2 pr-4">Application hosting and edge functions</td>
                  <td className="py-2">Global (US primary)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Anthropic (Claude)</td>
                  <td className="py-2 pr-4">AI/LLM processing for chat, scoring, email generation</td>
                  <td className="py-2">United States</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">OpenAI</td>
                  <td className="py-2 pr-4">AI/LLM processing, embeddings</td>
                  <td className="py-2">United States</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Apollo.io</td>
                  <td className="py-2 pr-4">Contact and company data enrichment</td>
                  <td className="py-2">United States</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Stripe</td>
                  <td className="py-2 pr-4">Payment processing</td>
                  <td className="py-2">United States</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Google (OAuth, Gmail API)</td>
                  <td className="py-2 pr-4">Authentication and email connectivity</td>
                  <td className="py-2">Global</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3">
            We maintain data processing agreements (DPAs) with all sub-processors. We
            will notify you of any material changes to our sub-processor list.
          </p>
        </section>

        {/* 8. International Transfers */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            8. International Data Transfers
          </h2>
          <p className="mt-3">
            Some of our sub-processors are located outside the European Economic Area
            (EEA). When transferring personal data outside the EEA, we rely on:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              EU-US Data Privacy Framework (for US-based processors that are
              certified)
            </li>
            <li>Standard Contractual Clauses (SCCs) approved by the European Commission</li>
            <li>Adequacy decisions by the European Commission, where available</li>
          </ul>
          <p className="mt-2">
            We conduct transfer impact assessments where required and implement
            supplementary measures to ensure an adequate level of data protection.
          </p>
        </section>

        {/* 9. Cookies */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            9. Cookies and Tracking
          </h2>
          <p className="mt-3">LeadSens uses the following types of cookies:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>
              <strong>Strictly necessary cookies:</strong> Required for authentication
              and session management. These cannot be disabled.
            </li>
            <li>
              <strong>Functional cookies:</strong> Remember your preferences and
              settings (e.g., sidebar state, filter selections).
            </li>
            <li>
              <strong>Analytics cookies:</strong> Help us understand how you use the
              Service to improve performance and usability. These are only set with
              your consent.
            </li>
          </ul>
          <p className="mt-2">
            We do not use third-party advertising cookies. We do not sell your data to
            advertisers.
          </p>
        </section>

        {/* 10. Security */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            10. Data Security
          </h2>
          <p className="mt-3">
            We implement appropriate technical and organizational measures to protect
            your personal data, including:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Encryption of data in transit (TLS 1.2+) and at rest</li>
            <li>Role-based access control and tenant isolation</li>
            <li>Regular security audits and vulnerability assessments</li>
            <li>Secure authentication via OAuth 2.0 and hashed credentials</li>
            <li>Automated backups with encryption</li>
          </ul>
        </section>

        {/* 11. Children */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            11. Children&apos;s Privacy
          </h2>
          <p className="mt-3">
            LeadSens is not intended for use by individuals under the age of 18. We
            do not knowingly collect personal data from children. If we learn that we
            have collected data from a child under 18, we will delete it promptly.
          </p>
        </section>

        {/* 12. Changes */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            12. Changes to This Policy
          </h2>
          <p className="mt-3">
            We may update this Privacy Policy from time to time. We will notify you of
            material changes at least 30 days in advance via email or in-app
            notification. The &quot;Last updated&quot; date at the top reflects the most recent
            revision.
          </p>
        </section>

        {/* 13. Contact DPO */}
        <section>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            13. Contact &amp; Data Protection Officer
          </h2>
          <p className="mt-3">
            For any privacy-related questions, to exercise your data rights, or to
            contact our Data Protection Officer:
          </p>
          <ul className="mt-2 list-none space-y-1 pl-0">
            <li>
              <strong>Email:</strong> privacy@elevay.dev
            </li>
            <li>
              <strong>Company:</strong> Elevay
            </li>
            <li>
              <strong>Country:</strong> France
            </li>
          </ul>
          <p className="mt-3">
            You also have the right to lodge a complaint with the French data
            protection authority:
          </p>
          <ul className="mt-2 list-none space-y-1 pl-0">
            <li>
              <strong>CNIL</strong> (Commission Nationale de l&apos;Informatique et des
              Libert&eacute;s)
            </li>
            <li>3 Place de Fontenoy, TSA 80715, 75334 Paris Cedex 07, France</li>
            <li>
              <strong>Website:</strong>{" "}
              <a
                href="https://www.cnil.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-accent)] hover:underline"
              >
                www.cnil.fr
              </a>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
