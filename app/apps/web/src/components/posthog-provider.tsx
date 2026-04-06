"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

/**
 * Lightweight PostHog page view tracker.
 * Avoids pulling in the full posthog-js SDK to keep bundle small.
 * Sends page views via fetch to the PostHog API.
 */
export function PostHogPageTracker({ userId }: { userId?: string }) {
  const pathname = usePathname();
  const lastPath = useRef("");

  useEffect(() => {
    if (!POSTHOG_KEY || !userId || pathname === lastPath.current) return;
    lastPath.current = pathname;

    const payload = {
      api_key: POSTHOG_KEY,
      event: "$pageview",
      distinct_id: userId,
      properties: {
        $current_url: window.location.href,
        $pathname: pathname,
        $lib: "elevay-client",
      },
      timestamp: new Date().toISOString(),
    };

    // Use sendBeacon for reliability, fall back to fetch
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(`${POSTHOG_HOST}/capture/`, blob);
    } else {
      fetch(`${POSTHOG_HOST}/capture/`, {
        method: "POST",
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  }, [pathname, userId]);

  return null;
}

/**
 * Track a custom event from client components
 */
export function trackEvent(
  userId: string,
  event: string,
  properties?: Record<string, unknown>
) {
  if (!POSTHOG_KEY) return;

  const payload = {
    api_key: POSTHOG_KEY,
    event,
    distinct_id: userId,
    properties: {
      ...properties,
      $lib: "elevay-client",
    },
    timestamp: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  if (navigator.sendBeacon) {
    navigator.sendBeacon(`${POSTHOG_HOST}/capture/`, blob);
  } else {
    fetch(`${POSTHOG_HOST}/capture/`, {
      method: "POST",
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  }
}
