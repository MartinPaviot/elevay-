import type { Metadata } from "next";
import "./globals.css";
import { SkipLink } from "@/components/a11y/skip-link";

export const metadata: Metadata = {
  title: {
    default: "Elevay — The Autonomous GTM Engine for Founders",
    template: "%s | Elevay",
  },
  description:
    "AI-powered CRM for founder-led sales. Auto-built TAM, ML scoring, outbound sequences, deal coaching — zero manual data entry. Start free.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://app.elevay.dev"
  ),
  openGraph: {
    title: "Elevay — The Autonomous GTM Engine for Founders",
    description:
      "AI-powered CRM for founder-led sales. Auto-built TAM, ML scoring, outbound sequences, deal coaching — zero manual data entry.",
    url: "/",
    siteName: "Elevay",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Elevay — The Autonomous GTM Engine for Founders",
    description:
      "AI-powered CRM for founder-led sales. Auto-built TAM, ML scoring, outbound sequences, deal coaching.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <SkipLink />
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
