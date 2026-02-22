import { NextRequest, NextResponse } from "next/server";

const PROTECTED_ROUTES = ["/roll", "/library", "/history"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if route needs auth
  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  if (!isProtected) return NextResponse.next();

  // Check session cookie
  const session = request.cookies.get("cratedig_session");
  if (!session?.value) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/roll/:path*", "/library/:path*", "/history/:path*"],
};
