import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./lib/jwt";

/**
 * Route protection (Next.js 16 renamed Middleware → Proxy).
 * Optimistic check on the signed session cookie; API routes re-verify.
 */
function homeFor(role: string): string {
  if (role === "director") return "/director";
  if (role === "accountant") return "/finance";
  return "/cm";
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(session ? homeFor(session.role) : "/login", req.url)
    );
  }

  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL(homeFor(session.role), req.url));
  }

  const isDirectorArea = pathname.startsWith("/director");
  const isCmArea = pathname.startsWith("/cm");
  const isFinanceArea = pathname.startsWith("/finance");
  const isProtected = isDirectorArea || isCmArea || isFinanceArea;

  if (isProtected && !session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Role isolation: keep each role inside its own area.
  if (session) {
    if (isDirectorArea && session.role !== "director") {
      return NextResponse.redirect(new URL(homeFor(session.role), req.url));
    }
    if (isCmArea && session.role !== "cm") {
      return NextResponse.redirect(new URL(homeFor(session.role), req.url));
    }
    if (isFinanceArea && session.role !== "accountant") {
      return NextResponse.redirect(new URL(homeFor(session.role), req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/director/:path*", "/cm/:path*", "/finance/:path*"],
};
