"use client";

import { useState, useEffect } from "react";
import { Nav } from "@/components/nav";

type Roll = {
  id: string;
  diceMode: string;
  outputSize: number;
  seedsUsed: number;
  seedsFailed: number;
  tracksFound: number;
  playlistId: string | null;
  playlistUrl: string | null;
  thumbnailUrl: string | null;
  rolledAt: string;
};

const MODE_EMOJI: Record<string, string> = {
  random: "🎲",
  deep: "🔥",
};

export default function HistoryPage() {
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/rolls?limit=50")
      .then((r) => r.json())
      .then((data) => {
        setRolls(data.rolls || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-vinyl-bg">
      <Nav />
      <main className="max-w-[600px] mx-auto px-4 py-8">
        <h1 className="font-display text-3xl tracking-[4px] mb-6">
          <span className="text-white">ROLL </span>
          <span className="text-orange-500">HISTORY</span>
        </h1>

        {loading && (
          <p className="text-neutral-500 font-mono text-sm text-center py-8">Loading...</p>
        )}

        {!loading && rolls.length === 0 && (
          <div className="text-center py-16">
            <p className="text-neutral-500 font-mono text-sm">No rolls yet.</p>
            <a href="/roll" className="text-orange-500 font-mono text-xs hover:underline mt-2 inline-block">
              Go dig! →
            </a>
          </div>
        )}

        {rolls.length > 0 && (
          <div className="border border-vinyl-border divide-y divide-vinyl-border">
            {rolls.map((roll) => (
              <div key={roll.id} className="flex items-center gap-3 px-3 py-3">
                {/* Thumbnail */}
                {roll.thumbnailUrl ? (
                  <img src={roll.thumbnailUrl} alt="" className="w-10 h-10 object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 bg-vinyl-card flex-shrink-0" />
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{MODE_EMOJI[roll.diceMode] || "🎲"}</span>
                    <span className="text-neutral-300 text-sm font-mono">
                      {roll.outputSize} tracks
                    </span>
                  </div>
                  <p className="text-neutral-600 text-[10px] font-mono">
                    {new Date(roll.rolledAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {roll.seedsUsed} seeds ({roll.seedsFailed} failed)
                  </p>
                </div>

                {/* YouTube link */}
                {roll.playlistUrl ? (
                  <a
                    href={roll.playlistUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-500 text-xs font-mono hover:underline flex-shrink-0"
                  >
                    YT →
                  </a>
                ) : (
                  <span className="text-neutral-700 text-[10px] font-mono flex-shrink-0">no playlist</span>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
