import { NextResponse } from "next/server";
import { createSessionCookie } from "@/lib/session";

/** Dev-only: sets session cookie without going through Google OAuth */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  const session = createSessionCookie("egertv@gmail.com");
  const response = NextResponse.redirect(new URL("/roll", "http://localhost:3005"));
  response.cookies.set(session.name, session.value, session.options as Parameters<typeof response.cookies.set>[2]);
  return response;
}
