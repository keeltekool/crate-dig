import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { youtubeConnections } from "@/lib/db/schema";

export async function GET() {
  const rows = await db.select().from(youtubeConnections).limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    email: rows[0].googleEmail,
    connectedAt: rows[0].connectedAt,
  });
}
