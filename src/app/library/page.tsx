"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Nav } from "@/components/nav";
import Papa from "papaparse";

type LibraryData = {
  filename: string;
  songCount: number;
  artistCount: number;
  songs: Array<{ artist: string; title: string; genre?: string }>;
  uploadedAt: string;
};

const ARTIST_COLUMNS = ["artist", "Artist", "artist_name", "ARTIST", "performer"];
const TITLE_COLUMNS = ["title", "Title", "track", "TITLE", "song", "name", "track_name"];
const GENRE_COLUMNS = ["genre", "Genre", "GENRE", "style"];

export default function LibraryPage() {
  const [library, setLibrary] = useState<LibraryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/library")
      .then((r) => r.json())
      .then((data) => {
        if (data.library) setLibrary(data.library);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const findColumn = (headers: string[], candidates: string[]): number => {
    const lower = headers.map((h) => h.toLowerCase().trim());
    for (const c of candidates) {
      const idx = lower.indexOf(c.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const handleFile = useCallback(async (file: File) => {
    setUploading(true);
    setError("");

    const text = await file.text();

    // Handle DJ software quirky format: rows wrapped in outer quotes
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      setError("CSV file is empty or has no data rows");
      setUploading(false);
      return;
    }

    // Try parsing header
    const headerResult = Papa.parse(lines[0], { header: false });
    const headers = (headerResult.data[0] as string[]).map((h) => h.trim());

    const artistIdx = findColumn(headers, ARTIST_COLUMNS);
    const titleIdx = findColumn(headers, TITLE_COLUMNS);
    const genreIdx = findColumn(headers, GENRE_COLUMNS);

    if (artistIdx === -1 || titleIdx === -1) {
      setError(`Could not find artist and title columns. Found: ${headers.join(", ")}`);
      setUploading(false);
      return;
    }

    // Parse data rows
    const songs: Array<{ artist: string; title: string; genre?: string }> = [];

    for (let i = 1; i < lines.length; i++) {
      let line = lines[i];

      // DJ software format: strip outer wrapping quotes
      if (line.startsWith('"') && line.endsWith('"') && line.length > 2) {
        line = line.slice(1, -1).replace(/""/g, '"');
      }

      const rowResult = Papa.parse(line, { header: false });
      const row = rowResult.data[0] as string[];
      if (!row || row.length <= Math.max(artistIdx, titleIdx)) continue;

      const artist = row[artistIdx]?.trim();
      const title = row[titleIdx]?.trim();
      const genre = genreIdx >= 0 && genreIdx < row.length ? row[genreIdx]?.trim() : undefined;

      if (artist && title) {
        const song: { artist: string; title: string; genre?: string } = { artist, title };
        if (genre) song.genre = genre;
        songs.push(song);
      }
    }

    if (songs.length === 0) {
      setError("No valid songs found in CSV");
      setUploading(false);
      return;
    }

    // Deduplicate by artist+title
    const seen = new Set<string>();
    const uniqueSongs = songs.filter((s) => {
      const key = `${s.artist.toLowerCase()}|${s.title.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Send to API
    try {
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, songs: uniqueSongs }),
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setLibrary(data.library);
    } catch {
      setError("Failed to save library to database");
    }

    setUploading(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith(".csv")) handleFile(file);
      else setError("Please drop a .csv file");
    },
    [handleFile]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  };

  const filteredSongs = library?.songs.filter(
    (s) =>
      !searchTerm ||
      s.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-vinyl-bg">
        <Nav />
        <main className="max-w-[600px] mx-auto px-4 py-8">
          <p className="text-neutral-500 font-mono text-sm text-center">Loading...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-vinyl-bg">
      <Nav />
      <main className="max-w-[600px] mx-auto px-4 py-8">
        {/* Header */}
        <h1 className="font-display text-3xl tracking-[4px] mb-6">
          <span className="text-white">YOUR </span>
          <span className="text-orange-500">CRATE</span>
          {library && (
            <span className="text-neutral-500 text-lg ml-3">· {library.songCount.toLocaleString()}</span>
          )}
        </h1>

        {/* Upload zone — ALWAYS visible */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed py-8 text-center cursor-pointer transition-all mb-6 ${
            dragOver
              ? "border-orange-500 bg-orange-500/5"
              : library
                ? "border-vinyl-border hover:border-orange-500/50"
                : "border-vinyl-border hover:border-orange-500/50 py-16"
          }`}
        >
          {uploading ? (
            <p className="text-orange-500 font-mono text-sm animate-pulse">
              Parsing CSV...
            </p>
          ) : library ? (
            <>
              <p className="text-neutral-400 font-mono text-sm">
                Drop a new CSV to replace your library
              </p>
              <p className="text-neutral-600 font-mono text-xs mt-1">
                Currently: <span className="text-neutral-400">{library.filename}</span> · {library.songCount.toLocaleString()} songs · {library.artistCount.toLocaleString()} artists
              </p>
            </>
          ) : (
            <>
              <p className="text-neutral-400 font-mono text-sm">
                Drop your CSV here or click to browse
              </p>
              <p className="text-neutral-600 font-mono text-xs mt-2">
                Needs at least Artist + Title columns
              </p>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 border border-red-500/30 bg-red-500/5 text-red-400 text-xs font-mono">
            {error}
          </div>
        )}

        {/* Library view */}
        {library && (
          <div className="space-y-4">
            {/* Genre coverage */}
            {(() => {
              const withGenre = library.songs.filter((s) => s.genre).length;
              if (withGenre === 0) return null;
              return (
                <p className="text-xs font-mono text-neutral-600">
                  {withGenre}/{library.songCount} songs have genre tags ({Math.round((withGenre / library.songCount) * 100)}%)
                </p>
              );
            })()}

            {/* Search */}
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search songs..."
              className="w-full bg-vinyl-card border border-vinyl-border px-3 py-2 text-sm font-mono text-neutral-300 focus:border-orange-500 focus:outline-none"
            />

            {/* Song list */}
            <div className="border border-vinyl-border divide-y divide-vinyl-border max-h-[500px] overflow-y-auto">
              {(filteredSongs || []).slice(0, 200).map((song, i) => (
                <div key={`${song.artist}-${song.title}-${i}`} className="flex items-center gap-3 px-3 py-2">
                  <span className="text-neutral-700 text-[10px] font-mono w-5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-orange-500 text-sm font-mono">{song.artist}</span>
                    <span className="text-neutral-600 mx-1.5">—</span>
                    <span className="text-neutral-400 text-sm font-mono">{song.title}</span>
                  </div>
                  {song.genre && (
                    <span className="text-neutral-600 text-[10px] font-mono flex-shrink-0">{song.genre}</span>
                  )}
                </div>
              ))}
              {filteredSongs && filteredSongs.length > 200 && (
                <div className="px-3 py-2 text-neutral-600 text-xs font-mono text-center">
                  Showing 200 of {filteredSongs.length} matches
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
