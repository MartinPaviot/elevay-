"use client";

import { useState } from "react";

interface CompanyLogoProps {
  domain: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
}

/**
 * Company logo with Clearbit → Google Favicons → Initials fallback cascade.
 * Renders a square image with rounded corners at the specified size.
 */
export function CompanyLogo({ domain, name, size = 24, className = "" }: CompanyLogoProps) {
  const [fallbackLevel, setFallbackLevel] = useState(0);
  // 0 = Clearbit, 1 = Google Favicons, 2 = Initials

  const initial = name?.charAt(0)?.toUpperCase() || "?";

  if (!domain || fallbackLevel >= 2) {
    return (
      <div
        className={`flex items-center justify-center rounded text-[10px] font-semibold shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          background: "var(--color-bg-emphasis)",
          color: "var(--color-text-tertiary)",
        }}
      >
        {initial}
      </div>
    );
  }

  const src =
    fallbackLevel === 0
      ? `https://logo.clearbit.com/${domain}`
      : `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <img
        src={src}
        alt=""
        className="absolute inset-0 rounded object-contain"
        style={{ width: size, height: size, background: "var(--color-bg-hover)" }}
        onError={() => setFallbackLevel((prev) => prev + 1)}
      />
      {/* Hidden initials fallback behind the image */}
      <div
        className="flex items-center justify-center rounded text-[10px] font-semibold"
        style={{
          width: size,
          height: size,
          background: "var(--color-bg-emphasis)",
          color: "var(--color-text-tertiary)",
        }}
      >
        {initial}
      </div>
    </div>
  );
}
