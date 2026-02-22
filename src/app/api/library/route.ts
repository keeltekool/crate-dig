import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { libraries } from "@/lib/db/schema";

// GET — Load library
export async function GET() {
  const rows = await db.select().from(libraries).limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ library: null });
  }

  return NextResponse.json({ library: rows[0] });
}

// POST — Upload/replace library
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { filename, songs } = body as {
    filename: string;
    songs: Array<{ artist: string; title: string; genre?: string }>;
  };

  if (!filename || !songs || !Array.isArray(songs) || songs.length === 0) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  // Count unique artists
  const artistSet = new Set(songs.map((s) => s.artist.toLowerCase()));

  // Single-user: delete existing, insert new
  await db.delete(libraries);
  const [row] = await db
    .insert(libraries)
    .values({
      filename,
      songs,
      songCount: songs.length,
      artistCount: artistSet.size,
    })
    .returning();

  return NextResponse.json({ library: row });
}
