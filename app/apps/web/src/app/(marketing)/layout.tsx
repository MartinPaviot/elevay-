import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Elevay — Your CRM finds customers, remembers everything, and does the work",
  description:
    "AI-powered CRM for founder-led sales. Auto-built TAM, ML scoring, outbound sequences, deal coaching — zero manual data entry. Start free.",
  openGraph: {
    title: "Elevay — Your CRM finds customers, remembers everything, and does the work",
    description:
      "AI-powered CRM for founder-led sales. Auto-built TAM, ML scoring, outbound sequences, deal coaching — zero manual data entry.",
    url: "/",
    siteName: "Elevay",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Elevay — Your CRM finds customers, remembers everything, and does the work",
    description:
      "AI-powered CRM for founder-led sales. Zero manual data entry. Start free.",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
