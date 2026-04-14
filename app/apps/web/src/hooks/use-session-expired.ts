"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";

/**
 * Session-expiry UX (E2). Detects 401 responses from same-origin API
 * calls (via a fetch monkey-patch scoped to the component lifecycle)
 * and redirects to `/sign-in?reason=session-expired&callbackUrl=<current>`.
 *
 * Debounced: only the first 401 in a burst triggers the redirect —
 * subsequent 401s from in-flight requests are ignored until the
 * component remounts. Keeps the redirect from fighting the toast.
 */
export function useSessionExpired() {
  const router = useRouter();
  const { toast } = useToast();
  const firedRef = useRef(false);

  useEffect(() => {
    // Only patch fetch once per window. React StrictMode triggers two
    // effect runs in dev; guard with a module-scope flag.
    const patched = (globalThis as unknown as { __sessionExpiredPatched?: boolean })
      .__sessionExpiredPatched;
    if (patched) return;
    (globalThis as unknown as { __sessionExpiredPatched?: boolean }).__sessionExpiredPatched = true;

    const original = globalThis.fetch;
    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      const res = await original(...args);
      if (res.status === 401 && !firedRef.current) {
        const url = typeof args[0] === "string"
          ? args[0]
          : args[0] instanceof URL
            ? args[0].href
            : (args[0] as Request).url;
        // Only treat same-origin 401s as session expiry — a third-party
        // API rejecting us shouldn't kick the user to sign-in.
        const isSameOrigin = url.startsWith("/") || (() => {
          try {
            return new URL(url, globalThis.location?.href ?? "http://localhost").origin ===
              globalThis.location?.origin;
          } catch {
            return false;
          }
        })();
        if (isSameOrigin) {
          firedRef.current = true;
          toast("Your session expired. Redirecting to sign in…", "warning");
          const current = globalThis.location?.pathname + (globalThis.location?.search ?? "");
          const callback = current && current !== "/sign-in"
            ? `&callbackUrl=${encodeURIComponent(current)}`
            : "";
          // Delay slightly so the toast is visible before navigation.
          setTimeout(() => {
            router.push(`/sign-in?reason=session-expired${callback}`);
          }, 500);
        }
      }
      return res;
    }) as typeof fetch;

    return () => {
      globalThis.fetch = original;
      (globalThis as unknown as { __sessionExpiredPatched?: boolean }).__sessionExpiredPatched = false;
    };
  }, [router, toast]);
}
