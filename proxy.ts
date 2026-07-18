import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./lib/jwt";

/**
 * Route protection (Next.js 16 renamed Middleware → Proxy).
 * Optimistic check on the signed session cookie; API routes re-verify.
 */
function homeFor(role: string): string {
  if (role === "director") return "/director";
  if (role === "accountant") return "/finance";
  if (role === "programme_manager") return "/pm";
  if (role === "mis") return "/mis";
  return "/cm";
}

const AREAS: { prefix: string; role: string }[] = [
  { prefix: "/director", role: "director" },
  { prefix: "/cm", role: "cm" },
  { prefix: "/finance", role: "accountant" },
  { prefix: "/pm", role: "programme_manager" },
  { prefix: "/mis", role: "mis" },
];

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

  const area = AREAS.find((a) => pathname.startsWith(a.prefix));

  if (area && !session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Role isolation: keep each role inside its own area.
  if (session && area && session.role !== area.role) {
    return NextResponse.redirect(new URL(homeFor(session.role), req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/director/:path*",
    "/cm/:path*",
    "/finance/:path*",
    "/pm/:path*",
    "/mis/:path*",
  ],
};
