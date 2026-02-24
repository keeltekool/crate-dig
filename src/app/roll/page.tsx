"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Nav } from "@/components/nav";
import { VinylRecord } from "@/components/vinyl-record";
import { rollSeeds, calculateSeedCount } from "@/lib/dice";
import type { Song, DiceMode } from "@/lib/dice";

type Track = {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
};

type RollState = "ready" | "rolling" | "preview" | "creating" | "pushed";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function RollPage() {
  const [library, setLibrary] = useState<Song[]>([]);
  const [libraryCount, setLibraryCount] = useState(0);
  const [ytConnected, setYtConnected] = useState(false);
  const [ytEmail, setYtEmail] = useState("");

  const [mode, setMode] = useState<DiceMode>("random");
  const [outputSize, setOutputSize] = useState(50);
  const [state, setState] = useState<RollState>("ready");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [rollStats, setRollStats] = useState({ seedsUsed: 0, seedsFailed: 0, rawFound: 0 });
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [playlistName, setPlaylistName] = useState("");
  const [error, setError] = useState("");
  const [genreOpen, setGenreOpen] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());

  // Extract unique genres sorted by count (most songs first)
  const genreList = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of library) {
      if (s.genre) {
        counts.set(s.genre, (counts.get(s.genre) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([genre, count]) => ({ genre, count }));
  }, [library]);

  // Filtered library based on selected genres
  const effectiveLibrary = useMemo(() => {
    if (selectedGenres.size === 0) return library;
    return library.filter((s) => s.genre && selectedGenres.has(s.genre));
  }, [library, selectedGenres]);

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(genre)) next.delete(genre);
      else next.add(genre);
      return next;
    });
  };

  // Load library and YouTube status on mount
  useEffect(() => {
    fetch("/api/library")
      .then((r) => r.json())
      .then((data) => {
        if (data.library) {
          setLibrary(data.library.songs);
          setLibraryCount(data.library.songCount);
        }
      });

    fetch("/api/youtube/status")
      .then((r) => r.json())
      .then((data) => {
        setYtConnected(data.connected);
        setYtEmail(data.email || "");
      });
  }, []);

  // Generate default playlist name
  useEffect(() => {
    const now = new Date();
    const formatted = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    setPlaylistName(`CrateDig Roll - ${formatted}`);
  }, []);

  const canRoll = effectiveLibrary.length > 0 && ytConnected && state === "ready";

  const handleRoll = useCallback(async () => {
    if (!canRoll) return;

    setState("rolling");
    setError("");
    setTracks([]);

    // Pick seeds from genre-filtered library (or full library if no filter)
    const seeds = rollSeeds(effectiveLibrary, outputSize, mode);

    try {
      const res = await fetch(`${API_URL}/roll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seeds: seeds.map((s) => ({ artist: s.artist, title: s.title })),
          desired_count: outputSize,
        }),
      });

      if (!res.ok) {
        throw new Error(`Backend error: ${res.status}`);
      }

      const data = await res.json();
      setRollStats({
        seedsUsed: data.seeds_used,
        seedsFailed: data.seeds_failed,
        rawFound: data.after_dedup,
      });

      setTracks(data.tracks.slice(0, outputSize));
      setState("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Roll failed");
      setState("ready");
    }
  }, [canRoll, effectiveLibrary, outputSize, mode]);

  const removeTrack = (videoId: string) => {
    setTracks((prev) => prev.filter((t) => t.videoId !== videoId));
  };

  const handleCreatePlaylist = useCallback(async () => {
    if (tracks.length === 0) return;

    setState("creating");
    setError("");

    try {
      const res = await fetch(`${API_URL}/create-playlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: playlistName,
          video_ids: tracks.map((t) => t.videoId),
        }),
      });

      if (!res.ok) {
        throw new Error(`Playlist creation failed: ${res.status}`);
      }

      const data = await res.json();
      setPlaylistUrl(data.url);

      // Save roll to history (non-blocking — playlist is already created)
      try {
        const historyRes = await fetch("/api/rolls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            diceMode: mode,
            outputSize: tracks.length,
            seedsUsed: rollStats.seedsUsed,
            seedsFailed: rollStats.seedsFailed,
            tracksFound: rollStats.rawFound,
            playlistId: data.playlist_id,
            playlistUrl: data.url,
            thumbnailUrl: tracks[0]?.thumbnail || null,
          }),
        });
        if (!historyRes.ok) {
          console.error("History save failed:", historyRes.status, await historyRes.text());
        }
      } catch (historyErr) {
        console.error("History save error:", historyErr);
      }

      setState("pushed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Playlist creation failed");
      setState("preview");
    }
  }, [tracks, playlistName, mode, rollStats]);

  const handleNewRoll = () => {
    setState("ready");
    setTracks([]);
    setPlaylistUrl("");
    setError("");
  };

  return (
    <div className="min-h-screen bg-vinyl-bg">
      <Nav />
      <main className="max-w-[600px] mx-auto px-4 py-8">
        {/* Hero vinyl */}
        <div className="flex justify-center mb-6">
          <VinylRecord
            size={120}
            spinning={state !== "ready"}
            fast={state === "rolling" || state === "creating"}
          />
        </div>

        {/* Title */}
        <h1 className="text-center font-display text-4xl tracking-[4px] mb-2">
          <span className="text-white">ROLL THE </span>
          <span className="text-orange-500">CRATE</span>
        </h1>

        {/* Status line */}
        <p className="text-center text-neutral-500 text-xs font-mono mb-8">
          {libraryCount > 0 ? (
            selectedGenres.size > 0 ? (
              <><span className="text-orange-500">{effectiveLibrary.length.toLocaleString()}</span>{" of "}{libraryCount.toLocaleString()} songs</>
            ) : (
              `${libraryCount.toLocaleString()} songs loaded`
            )
          ) : "No library uploaded"}
          {" · "}
          {ytConnected ? (
            <span className="text-green-500">YouTube connected {ytEmail && `(${ytEmail})`}</span>
          ) : (
            <span className="text-red-400">YouTube not connected</span>
          )}
        </p>

        {/* Controls — only show when ready */}
        {(state === "ready") && (
          <div className="space-y-6">
            {/* Dice mode selector */}
            <div className="flex gap-3">
              <button
                onClick={() => setMode("random")}
                className={`flex-1 py-3 font-mono text-sm tracking-wider border transition-all ${
                  mode === "random"
                    ? "border-orange-500 text-orange-500 bg-orange-500/10"
                    : "border-vinyl-border text-neutral-500 hover:border-neutral-600"
                }`}
              >
                🎲 RANDOM
              </button>
              <button
                onClick={() => setMode("deep")}
                className={`flex-1 py-3 font-mono text-sm tracking-wider border transition-all ${
                  mode === "deep"
                    ? "border-orange-500 text-orange-500 bg-orange-500/10"
                    : "border-vinyl-border text-neutral-500 hover:border-neutral-600"
                }`}
              >
                🔥 DEEP
              </button>
            </div>

            {/* Genre filter ribbon */}
            {genreList.length > 0 && (
              <div>
                <button
                  onClick={() => setGenreOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between px-3 py-2 border border-vinyl-border text-xs font-mono text-neutral-500 hover:border-neutral-600 transition-all"
                >
                  <span>
                    {selectedGenres.size > 0 ? (
                      <><span className="text-orange-500">{selectedGenres.size} genre{selectedGenres.size > 1 ? "s" : ""}</span> selected</>
                    ) : (
                      "Filter by genre"
                    )}
                  </span>
                  <span className={`transition-transform ${genreOpen ? "rotate-180" : ""}`}>▾</span>
                </button>
                {genreOpen && (
                  <div className="border border-t-0 border-vinyl-border px-3 py-3 flex flex-wrap gap-2 max-h-[200px] overflow-y-auto">
                    {genreList.map(({ genre, count }) => (
                      <button
                        key={genre}
                        onClick={() => toggleGenre(genre)}
                        className={`px-2 py-1 text-[11px] font-mono border transition-all ${
                          selectedGenres.has(genre)
                            ? "border-orange-500 text-orange-500 bg-orange-500/10"
                            : "border-vinyl-border text-neutral-500 hover:border-neutral-600"
                        }`}
                      >
                        {genre} <span className="text-neutral-600">{count}</span>
                      </button>
                    ))}
                    {selectedGenres.size > 0 && (
                      <button
                        onClick={() => setSelectedGenres(new Set())}
                        className="px-2 py-1 text-[11px] font-mono text-red-400/70 hover:text-red-400 transition-colors"
                      >
                        clear all
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Output slider */}
            <div>
              <div className="flex justify-between text-xs font-mono text-neutral-500 mb-2">
                <span>OUTPUT</span>
                <span className="text-orange-500">{outputSize} tracks</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                step={10}
                value={outputSize}
                onChange={(e) => setOutputSize(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] font-mono text-neutral-600 mt-1">
                <span>10</span>
                <span>seeds: {calculateSeedCount(outputSize)}</span>
                <span>100</span>
              </div>
            </div>

            {/* Roll button */}
            <button
              onClick={handleRoll}
              disabled={!canRoll}
              className={`w-full py-4 font-display text-2xl tracking-[4px] transition-all ${
                canRoll
                  ? "bg-orange-500 text-black hover:bg-orange-600 hover:shadow-[0_0_30px_rgba(249,115,22,0.2)]"
                  : "bg-neutral-800 text-neutral-600 cursor-not-allowed"
              }`}
            >
              ROLL THE DICE
            </button>

            {!ytConnected && (
              <a
                href="/api/youtube/connect"
                className="block text-center text-orange-500 text-xs font-mono hover:underline"
              >
                Connect YouTube first →
              </a>
            )}
            {library.length === 0 && (
              <a
                href="/library"
                className="block text-center text-orange-500 text-xs font-mono hover:underline"
              >
                Upload your library first →
              </a>
            )}
          </div>
        )}

        {/* Rolling state */}
        {state === "rolling" && (
          <div className="text-center py-12">
            <p className="text-orange-500 font-mono text-sm animate-pulse">
              Searching YouTube Music...
            </p>
            <p className="text-neutral-600 font-mono text-xs mt-2">
              {calculateSeedCount(outputSize)} seeds × ~50 related tracks each
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 border border-red-500/30 bg-red-500/5 text-red-400 text-xs font-mono">
            {error}
          </div>
        )}

        {/* Preview tracks */}
        {(state === "preview" || state === "creating" || state === "pushed") && tracks.length > 0 && (
          <div className="mt-6 space-y-4">
            {/* Stats */}
            <div className="flex gap-4 text-[10px] font-mono text-neutral-600">
              <span>seeds: {rollStats.seedsUsed}</span>
              <span>failed: {rollStats.seedsFailed}</span>
              <span>found: {rollStats.rawFound}</span>
              <span>showing: {tracks.length}</span>
            </div>

            {/* Track list */}
            <div className="border border-vinyl-border divide-y divide-vinyl-border max-h-[400px] overflow-y-auto">
              {tracks.map((track, i) => (
                <div key={track.videoId} className="flex items-center gap-3 px-3 py-2 group">
                  <span className="text-neutral-600 text-[10px] font-mono w-5 text-right">{i + 1}</span>
                  {track.thumbnail && (
                    <img
                      src={track.thumbnail}
                      alt=""
                      className="w-8 h-8 object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-orange-500 text-sm font-mono truncate">{track.artist}</p>
                    <p className="text-neutral-400 text-xs font-mono truncate">{track.title}</p>
                  </div>
                  {state === "preview" && (
                    <button
                      onClick={() => removeTrack(track.videoId)}
                      className="text-neutral-600 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Push section */}
            {state === "preview" && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  className="w-full bg-vinyl-card border border-vinyl-border px-3 py-2 text-sm font-mono text-neutral-300 focus:border-orange-500 focus:outline-none"
                  placeholder="Playlist name..."
                />
                <button
                  onClick={handleCreatePlaylist}
                  className="w-full py-3 bg-orange-500 text-black font-display text-lg tracking-[3px] hover:bg-orange-600 transition-all hover:shadow-[0_0_30px_rgba(249,115,22,0.2)]"
                >
                  CREATE PLAYLIST ON YT
                </button>
              </div>
            )}

            {/* Creating state */}
            {state === "creating" && (
              <p className="text-center text-orange-500 font-mono text-sm animate-pulse">
                Creating playlist...
              </p>
            )}

            {/* Pushed state */}
            {state === "pushed" && playlistUrl && (
              <div className="space-y-3 text-center">
                <p className="text-green-500 font-mono text-sm">Playlist created!</p>
                <a
                  href={playlistUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block py-3 border border-orange-500 text-orange-500 font-display text-lg tracking-[3px] hover:bg-orange-500/10 transition-all"
                >
                  OPEN ON YOUTUBE MUSIC
                </a>
                <button
                  onClick={handleNewRoll}
                  className="text-neutral-500 font-mono text-xs hover:text-neutral-300 transition-colors"
                >
                  Roll again →
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
