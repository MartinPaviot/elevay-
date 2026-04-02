"use client";

import { useState } from "react";
import { Check, Zap } from "lucide-react";

interface Tier {
  name: string;
  price: string;
  priceNote: string;
  description: string;
  cta: string;
  priceEnvKey: string | null;
  highlighted: boolean;
  features: string[];
}

const tiers: Tier[] = [
  {
    name: "Free Trial",
    price: "$0",
    priceNote: "14 days",
    description: "Try LeadSens with your real data. No credit card required.",
    cta: "Current Plan",
    priceEnvKey: null,
    highlighted: false,
    features: [
      "100 contacts",
      "50 emails / month",
      "100 AI queries / month",
      "Automatic email capture",
      "Basic lead scoring",
      "1 connected mailbox",
      "Community support",
    ],
  },
  {
    name: "Starter",
    price: "$49",
    priceNote: "/month",
    description: "For founder-led sales teams closing their first deals.",
    cta: "Get Started",
    priceEnvKey: "NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID",
    highlighted: true,
    features: [
      "1,000 contacts",
      "500 emails / month",
      "500 AI queries / month",
      "Automatic email capture",
      "ML-powered lead scoring",
      "3 connected mailboxes",
      "Outbound sequences",
      "Deal pipeline",
      "Email support",
    ],
  },
  {
    name: "Pro",
    price: "$99",
    priceNote: "/month",
    description: "Full autonomous GTM engine. Zero manual work.",
    cta: "Go Pro",
    priceEnvKey: "NEXT_PUBLIC_STRIPE_PRO_PRICE_ID",
    highlighted: false,
    features: [
      "10,000 contacts",
      "5,000 emails / month",
      "Unlimited AI queries",
      "Automatic email capture",
      "ML-powered lead scoring",
      "Unlimited mailboxes",
      "Outbound sequences",
      "Deal pipeline + coaching",
      "Signal-based prioritization",
      "Auto-built TAM",
      "Priority support",
    ],
  },
];

export default function PricingPage() {
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  async function handleCheckout(tier: Tier) {
    if (!tier.priceEnvKey) return;

    const priceId =
      tier.priceEnvKey === "NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID"
        ? process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID
        : process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID;

    if (!priceId) return;

    setLoadingTier(tier.name);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      console.error("Failed to start checkout");
    } finally {
      setLoadingTier(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="text-center">
        <h1
          className="text-[32px] font-bold tracking-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          Simple, transparent pricing
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-[15px]" style={{ color: "var(--color-text-tertiary)" }}>
          Start free. Upgrade when you need more power. All plans include a 14-day trial.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className="relative flex flex-col rounded-xl p-6"
            style={{
              background: "var(--color-bg-surface)",
              border: tier.highlighted
                ? "1px solid var(--color-accent)"
                : "0.5px solid var(--color-border-default)",
            }}
          >
            {tier.highlighted && (
              <div
                className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[11px] font-semibold text-white"
                style={{ background: "var(--color-accent)" }}
              >
                Most Popular
              </div>
            )}

            <div>
              <h3
                className="text-[15px] font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                {tier.name}
              </h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span
                  className="text-[36px] font-bold tracking-tight"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {tier.price}
                </span>
                <span
                  className="text-[14px]"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {tier.priceNote}
                </span>
              </div>
              <p
                className="mt-2 text-[13px]"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {tier.description}
              </p>
            </div>

            <button
              onClick={() => handleCheckout(tier)}
              disabled={!tier.priceEnvKey || loadingTier === tier.name}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-semibold transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-60"
              style={{
                background: tier.highlighted
                  ? "var(--color-accent)"
                  : "transparent",
                color: tier.highlighted
                  ? "#fff"
                  : "var(--color-text-primary)",
                border: tier.highlighted
                  ? "none"
                  : "0.5px solid var(--color-border-moderate)",
              }}
            >
              {loadingTier === tier.name ? (
                "Redirecting..."
              ) : (
                <>
                  {tier.highlighted && <Zap size={14} />}
                  {tier.cta}
                </>
              )}
            </button>

            <div
              className="my-6 h-px"
              style={{ background: "var(--color-border-default)" }}
            />

            <ul className="flex-1 space-y-2.5">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <Check
                    size={15}
                    className="mt-0.5 shrink-0"
                    style={{ color: "var(--color-accent)" }}
                  />
                  <span
                    className="text-[13px]"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
