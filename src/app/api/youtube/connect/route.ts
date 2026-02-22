import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin}/api/youtube/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/userinfo.email",
    access_type: "offline",
    prompt: "consent",
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
