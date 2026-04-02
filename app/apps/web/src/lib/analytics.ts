/**
 * PostHog analytics wrapper.
 * Provides type-safe event tracking throughout the app.
 * In server context, events are sent via the PostHog API directly.
 * In client context, uses the PostHog JS SDK.
 */

// Event definitions for type safety
export type AnalyticsEvent =
  | { event: "signup"; properties: { method: "google" | "credentials" } }
  | { event: "signin"; properties: { method: "google" | "credentials" } }
  | { event: "activation"; properties: { trigger: string } }
  | { event: "page_view"; properties: { path: string } }
  | { event: "feature_used"; properties: { feature: string; action: string } }
  | { event: "chat_query"; properties: { queryLength: number; threadId?: string } }
  | { event: "email_generated"; properties: { type: "cold" | "follow_up" | "reply" } }
  | { event: "contact_enriched"; properties: { source: string } }
  | { event: "sequence_created"; properties: { stepCount: number } }
  | { event: "deal_created"; properties: { value?: number; stage: string } }
  | { event: "import_completed"; properties: { type: string; count: number } }
  | { event: "subscription_started"; properties: { plan: string } }
  | { event: "subscription_canceled"; properties: { plan: string; reason?: string } };

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

/**
 * Server-side event capture via PostHog API
 */
export async function captureEvent(
  distinctId: string,
  event: AnalyticsEvent["event"],
  properties?: Record<string, unknown>
): Promise<void> {
  if (!POSTHOG_KEY) return;

  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event,
        distinct_id: distinctId,
        properties: {
          ...properties,
          $lib: "leadsens-server",
        },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Analytics should never break the app
  }
}

/**
 * Identify a user in PostHog (server-side)
 */
export async function identifyUser(
  distinctId: string,
  properties: {
    email?: string;
    name?: string;
    tenantId?: string;
    plan?: string;
    createdAt?: string;
  }
): Promise<void> {
  if (!POSTHOG_KEY) return;

  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event: "$identify",
        distinct_id: distinctId,
        properties: { $set: properties },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Analytics should never break the app
  }
}
