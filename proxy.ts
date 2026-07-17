import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./lib/jwt";

/**
 * Route protection (Next.js 16 renamed Middleware → Proxy).
 * This is an optimistic check based on the signed session cookie.
 * API routes still re-verify against the database via `requireUser()`.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const homeFor = (role: string) => (role === "director" ? "/director" : "/cm");

  // Root → route to the right place.
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(session ? homeFor(session.role) : "/login", req.url)
    );
  }

  // Already logged in but visiting /login → go home.
  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL(homeFor(session.role), req.url));
  }

  const isDirectorArea = pathname.startsWith("/director");
  const isCmArea = pathname.startsWith("/cm");

  // Protected areas require a session.
  if ((isDirectorArea || isCmArea) && !session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Role isolation: keep each role inside its own area.
  if (session && isDirectorArea && session.role !== "director") {
    return NextResponse.redirect(new URL("/cm", req.url));
  }
  if (session && isCmArea && session.role !== "cm") {
    return NextResponse.redirect(new URL("/director", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/director/:path*", "/cm/:path*"],
};
