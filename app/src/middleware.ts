import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Client-facing and auth pages that must work without a clinician session.
const PUBLIC_PREFIXES = ["/login", "/signup", "/invite", "/portal", "/f/", "/book", "/join", "/api/public"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Whole path segments only: "/book" and "/book/x" are public, "/bookkeeping" is not.
  if (PUBLIC_PREFIXES.some((p) => (p.endsWith("/") ? pathname.startsWith(p) : pathname === p || pathname.startsWith(`${p}/`)))) {
    return NextResponse.next();
  }
  const jwt = req.cookies.get("solace_session")?.value;
  if (jwt) {
    try {
      await jwtVerify(jwt, new TextEncoder().encode(process.env.APP_SECRET));
      return NextResponse.next();
    } catch {
      // fall through to login
    }
  }
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|ico|webp)$).*)"],
};
