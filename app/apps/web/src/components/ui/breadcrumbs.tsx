"use client";

import Link from "next/link";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-xs"
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && (
              <span
                className="select-none"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                ›
              </span>
            )}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="transition-colors hover:underline"
                style={{ color: "var(--color-text-tertiary)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--color-text-secondary)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--color-text-tertiary)")
                }
              >
                {item.label}
              </Link>
            ) : (
              <span style={{ color: "var(--color-text-secondary)" }}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
