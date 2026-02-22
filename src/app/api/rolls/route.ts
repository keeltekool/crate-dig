import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rolls } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

// GET — Load roll history
export async function GET(request: NextRequest) {
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20");
  const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0");

  const rows = await db
    .select()
    .from(rolls)
    .orderBy(desc(rolls.rolledAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ rolls: rows });
}

// POST — Save a roll
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { diceMode, outputSize, seedsUsed, seedsFailed, tracksFound, playlistId, playlistUrl, thumbnailUrl } = body;

  const [row] = await db
    .insert(rolls)
    .values({
      diceMode,
      outputSize,
      seedsUsed,
      seedsFailed: seedsFailed || 0,
      tracksFound,
      playlistId: playlistId || null,
      playlistUrl: playlistUrl || null,
      thumbnailUrl: thumbnailUrl || null,
    })
    .returning();

  return NextResponse.json({ roll: row });
}
