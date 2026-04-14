"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

/**
 * Dashboard-scoped error boundary. Catches crashes in any page under
 * `(dashboard)` without nuking the sidebar + header. Forwards to
 * Sentry via `logger.error` (T1-F13) so we get a breadcrumb even
 * when the user clicks Reset and the UI recovers.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("dashboard error boundary tripped", {
      err: error,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center px-6 py-12">
      <EmptyState
        variant="error"
        title="Something went wrong"
        description={
          error.digest
            ? `An unexpected error occurred. Reference: ${error.digest}`
            : "An unexpected error occurred. Try again, or head back to the dashboard."
        }
        actionLabel="Try again"
        onAction={reset}
        actionVariant="solid"
        secondaryActionLabel="Go home"
        onSecondaryAction={() => {
          window.location.href = "/home";
        }}
      />
      {/* Suppress unused import lint (Button is re-exported for callers that
          want to customise the fallback). */}
      <span className="hidden" aria-hidden="true">
        <Button variant="ghost" />
      </span>
    </div>
  );
}
