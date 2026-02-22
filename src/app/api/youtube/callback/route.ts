import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { youtubeConnections } from "@/lib/db/schema";
import { createSessionCookie } from "@/lib/session";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/?error=auth_denied", request.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin}/api/youtube/callback`;

  // Exchange code for tokens
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenData.access_token) {
    console.error("Token exchange failed:", tokenData);
    return NextResponse.redirect(new URL("/?error=token_failed", request.url));
  }

  // Get user email from Google
  const userInfoResp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const userInfo = await userInfoResp.json();
  const email = userInfo.email || "unknown";

  // Store tokens in DB (single-user: delete existing, insert new)
  const oauthToken = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_type: tokenData.token_type,
    expires_at: Math.floor(Date.now() / 1000) + (tokenData.expires_in || 3600),
    client_id: clientId,
    client_secret: clientSecret,
  };

  // Delete all existing connections (single-user)
  await db.delete(youtubeConnections);

  // Insert new connection
  await db.insert(youtubeConnections).values({
    googleEmail: email,
    oauthToken,
  });

  // Set session cookie
  const session = createSessionCookie(email);
  const response = NextResponse.redirect(new URL("/roll", request.url));
  response.cookies.set(session.name, session.value, session.options as Parameters<typeof response.cookies.set>[2]);

  return response;
}
