import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { youtubeConnections } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.get("ids");
  if (!ids) {
    return NextResponse.json({ existing: [] });
  }

  const playlistIds = ids.split(",").filter(Boolean);
  if (playlistIds.length === 0) {
    return NextResponse.json({ existing: [] });
  }

  // Get access token from DB
  const rows = await db.select().from(youtubeConnections).limit(1);
  if (rows.length === 0) {
    return NextResponse.json({ existing: [], error: "not_connected" });
  }

  const token = rows[0].oauthToken;
  if (!token || typeof token !== "object") {
    return NextResponse.json({ existing: [], error: "no_token" });
  }

  const oauthToken = token as { access_token: string; refresh_token: string; expires_at: number; client_id: string; client_secret: string };

  // Refresh token if expired
  let accessToken = oauthToken.access_token;
  if (oauthToken.expires_at < Math.floor(Date.now() / 1000) + 60) {
    try {
      const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: oauthToken.client_id,
          client_secret: oauthToken.client_secret,
          refresh_token: oauthToken.refresh_token,
          grant_type: "refresh_token",
        }),
      });
      const refreshData = await refreshRes.json();
      if (refreshData.access_token) {
        accessToken = refreshData.access_token;
      }
    } catch {
      // Use existing token as fallback
    }
  }

  // Batch check playlists (max 50 per request)
  const batchIds = playlistIds.slice(0, 50).join(",");
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?part=id&id=${encodeURIComponent(batchIds)}&maxResults=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      console.error("YouTube API error:", res.status);
      return NextResponse.json({ existing: playlistIds, error: "api_error" });
    }

    const data = await res.json();
    const existingIds = (data.items || []).map((item: { id: string }) => item.id);
    return NextResponse.json({ existing: existingIds });
  } catch (err) {
    console.error("Playlist check failed:", err);
    // On error, assume all exist (don't show false "deleted" badges)
    return NextResponse.json({ existing: playlistIds, error: "fetch_error" });
  }
}
