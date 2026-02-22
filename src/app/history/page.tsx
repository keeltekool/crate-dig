"use client";

import { useState, useEffect, useCallback } from "react";
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
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/rolls?limit=50")
      .then((r) => r.json())
      .then(async (data) => {
        const loadedRolls: Roll[] = data.rolls || [];
        setRolls(loadedRolls);
        setLoading(false);

        // Check which playlists still exist on YouTube
        const playlistIds = loadedRolls
          .map((r) => r.playlistId)
          .filter((id): id is string => !!id);

        if (playlistIds.length > 0) {
          try {
            const checkRes = await fetch(`/api/youtube/check-playlists?ids=${playlistIds.join(",")}`);
            if (checkRes.ok) {
              const checkData = await checkRes.json();
              const existingSet = new Set<string>(checkData.existing);
              // Find rolls whose playlists were deleted on YouTube
              const deletedRolls = loadedRolls.filter(
                (r) => r.playlistId && !existingSet.has(r.playlistId)
              );
              if (deletedRolls.length > 0) {
                // Auto-delete from DB and remove from UI
                const deletePromises = deletedRolls.map((r) =>
                  fetch(`/api/rolls?id=${r.id}`, { method: "DELETE" }).catch(() => {})
                );
                await Promise.all(deletePromises);
                const deletedIds = new Set(deletedRolls.map((r) => r.id));
                setRolls((prev) => prev.filter((r) => !deletedIds.has(r.id)));
              }
            }
          } catch {
            // Silently fail — don't delete on API errors
          }
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/rolls?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setRolls((prev) => prev.filter((r) => r.id !== id));
      }
    } catch {
      // Silent fail
    }
    setDeleting(null);
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
                <div key={roll.id} className="flex items-center gap-3 px-3 py-3 group">
                  {/* Thumbnail */}
                  {roll.thumbnailUrl ? (
                    <img
                      src={roll.thumbnailUrl}
                      alt=""
                      className="w-10 h-10 object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-vinyl-card flex-shrink-0" />
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{MODE_EMOJI[roll.diceMode] || "🎲"}</span>
                      <span className="text-sm font-mono text-neutral-300">
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

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {roll.playlistUrl ? (
                      <a
                        href={roll.playlistUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-500 text-xs font-mono hover:underline"
                      >
                        YT →
                      </a>
                    ) : (
                      <span className="text-neutral-700 text-[10px] font-mono">no playlist</span>
                    )}

                    <button
                      onClick={() => handleDelete(roll.id)}
                      disabled={deleting === roll.id}
                      className="text-neutral-700 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                      title="Delete from history"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </main>
    </div>
  );
}
