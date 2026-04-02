import Link from "next/link";
import type { Metadata } from "next";
import {
  Zap,
  Brain,
  Mail,
  Target,
  BarChart3,
  Shield,
  MessageSquare,
  Users,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "LeadSens — The Autonomous GTM Engine for Founders",
};

const features = [
  {
    icon: Target,
    title: "Auto-Built TAM",
    description:
      "Define your ICP in a conversation. We build your total addressable market automatically using real company data, ML scoring, and signal detection.",
  },
  {
    icon: Brain,
    title: "AI Deal Coaching",
    description:
      "Get coaching that references your actual pipeline data, meeting transcripts, and deal signals — not generic sales advice.",
  },
  {
    icon: Mail,
    title: "Autonomous Outbound",
    description:
      "Multi-step sequences with AI-generated, personalized emails. Mailbox warming, rotation, and deliverability monitoring built in.",
  },
  {
    icon: MessageSquare,
    title: "Chat-First CRM",
    description:
      "Ask your CRM anything in natural language. Get answers with citations to specific emails, meetings, and records.",
  },
  {
    icon: BarChart3,
    title: "Zero Data Entry",
    description:
      "Every email, meeting, and interaction is captured automatically. Your pipeline stays accurate without lifting a finger.",
  },
  {
    icon: Shield,
    title: "Customer Memory",
    description:
      "Schema-less data model captures everything. 2-year email backfill. 90%+ recall accuracy on any query about any contact.",
  },
];

const pricingTiers = [
  {
    name: "Trial",
    price: "Free",
    period: "14 days",
    description: "Try everything. No credit card required.",
    features: [
      "100 contacts",
      "50 emails / month",
      "100 AI queries / month",
      "Full feature access",
    ],
    cta: "Start Free Trial",
    href: "/sign-in",
    primary: false,
  },
  {
    name: "Starter",
    price: "$49",
    period: "/month",
    description: "For founders starting outbound.",
    features: [
      "1,000 contacts",
      "500 emails / month",
      "500 AI queries / month",
      "1 connected mailbox",
      "Email support",
    ],
    cta: "Get Started",
    href: "/sign-in",
    primary: false,
  },
  {
    name: "Pro",
    price: "$99",
    period: "/month",
    description: "For founders scaling pipeline.",
    features: [
      "10,000 contacts",
      "5,000 emails / month",
      "Unlimited AI queries",
      "5 connected mailboxes",
      "Priority support",
      "Custom signals",
      "API access",
    ],
    cta: "Get Started",
    href: "/sign-in",
    primary: true,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-base)]">
      {/* Nav */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <Zap size={20} className="text-[var(--color-accent)]" />
          <span className="text-lg font-bold text-[var(--color-text-primary)]">
            LeadSens
          </span>
        </div>
        <div className="flex items-center gap-6">
          <Link
            href="#features"
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            Features
          </Link>
          <Link
            href="#pricing"
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            Pricing
          </Link>
          <Link
            href="/sign-in"
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pb-20 pt-16 text-center">
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.08)] bg-[var(--color-bg-surface)] px-3 py-1 text-xs text-[var(--color-text-secondary)]">
          <Zap size={12} className="text-[var(--color-accent)]" />
          Built for founder-led sales
        </div>
        <h1 className="text-5xl font-bold leading-tight tracking-tight text-[var(--color-text-primary)]">
          Your entire GTM engine,
          <br />
          <span className="text-[var(--color-accent)]">on autopilot</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--color-text-secondary)]">
          LeadSens combines AI-powered CRM, autonomous outbound, and deal coaching
          into one tool. Auto-built TAM. Zero data entry. Chat-first interface.
          Built for founders who sell.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-white hover:opacity-90"
          >
            Start Free Trial
            <ArrowRight size={16} />
          </Link>
          <Link
            href="#features"
            className="inline-flex items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.08)] px-6 py-3 text-sm font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)]"
          >
            See Features
          </Link>
        </div>
        <p className="mt-4 text-xs text-[var(--color-text-tertiary)]">
          14-day free trial. No credit card required.
        </p>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-[var(--color-text-primary)]">
            Everything you need to close deals
          </h2>
          <p className="mt-3 text-[var(--color-text-secondary)]">
            Enterprise-grade intelligence. Perfect memory. One tool.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[var(--color-bg-surface)] p-6"
              >
                <div className="mb-3 inline-flex rounded-lg bg-[var(--color-accent-soft)] p-2">
                  <Icon size={20} className="text-[var(--color-accent)]" />
                </div>
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  {f.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-[var(--color-text-primary)]">
            Simple, transparent pricing
          </h2>
          <p className="mt-3 text-[var(--color-text-secondary)]">
            Start free. Upgrade when you're ready.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {pricingTiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-xl border p-6 ${
                tier.primary
                  ? "border-[var(--color-accent)] bg-[var(--color-bg-surface)]"
                  : "border-[rgba(255,255,255,0.06)] bg-[var(--color-bg-surface)]"
              }`}
            >
              {tier.primary && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-accent)] px-3 py-0.5 text-xs font-medium text-white">
                  Most Popular
                </div>
              )}
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                {tier.name}
              </h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-[var(--color-text-primary)]">
                  {tier.price}
                </span>
                <span className="text-sm text-[var(--color-text-tertiary)]">
                  {tier.period}
                </span>
              </div>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                {tier.description}
              </p>
              <ul className="mt-4 space-y-2">
                {tier.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]"
                  >
                    <svg
                      className="h-4 w-4 shrink-0 text-[var(--color-accent)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={tier.href}
                className={`mt-6 block rounded-lg px-4 py-2.5 text-center text-sm font-medium ${
                  tier.primary
                    ? "bg-[var(--color-accent)] text-white hover:opacity-90"
                    : "border border-[rgba(255,255,255,0.08)] text-[var(--color-text-primary)] hover:border-[var(--color-accent)]"
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-[var(--color-text-primary)]">
          Ready to put your GTM on autopilot?
        </h2>
        <p className="mt-3 text-[var(--color-text-secondary)]">
          Join founders who closed their first deals without a single SDR.
        </p>
        <Link
          href="/sign-in"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-8 py-3 text-sm font-medium text-white hover:opacity-90"
        >
          Start Free Trial
          <ArrowRight size={16} />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-[rgba(255,255,255,0.06)] py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-[var(--color-accent)]" />
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">
              LeadSens by Elevay
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs text-[var(--color-text-tertiary)]">
            <Link href="/terms" className="hover:text-[var(--color-text-secondary)]">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-[var(--color-text-secondary)]">
              Privacy Policy
            </Link>
            <Link href="/acceptable-use" className="hover:text-[var(--color-text-secondary)]">
              Acceptable Use
            </Link>
            <a
              href="mailto:support@elevay.dev"
              className="hover:text-[var(--color-text-secondary)]"
            >
              Support
            </a>
          </div>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            &copy; {new Date().getFullYear()} Elevay SAS. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
