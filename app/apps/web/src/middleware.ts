import { auth } from "./auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Public routes that don't require auth
  const publicPaths = [
    "/sign-in",
    "/sign-up",
    "/landing",
    "/terms",
    "/privacy",
    "/acceptable-use",
    "/pricing",
    "/api/auth",
    "/api/health",
    "/api/unsubscribe",
    "/api/webhooks",
    "/api/inngest",
  ];

  const isPublic = publicPaths.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  // Root path: show landing if not authenticated, dashboard if authenticated
  if (pathname === "/") {
    if (!req.auth?.user) {
      return NextResponse.rewrite(new URL("/landing", req.url));
    }
    return NextResponse.next();
  }

  // Protected routes: redirect to sign-in if not authenticated
  if (!req.auth?.user) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
