export type Song = {
  artist: string;
  title: string;
  genre?: string;
};

export type DiceMode = "random" | "deep";

/** Pure random shuffle, pick N seeds */
export function rollRandom(songs: Song[], count: number): Song[] {
  const shuffled = [...songs].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/** Pick from artists with only 1-2 tracks (niche corners) */
export function rollDeep(songs: Song[], count: number): Song[] {
  const artistCounts = new Map<string, number>();
  songs.forEach((s) => {
    const key = s.artist.toLowerCase();
    artistCounts.set(key, (artistCounts.get(key) || 0) + 1);
  });

  const nicheSongs = songs.filter((s) => (artistCounts.get(s.artist.toLowerCase()) || 0) <= 2);

  if (nicheSongs.length < count) {
    // Not enough niche songs, fall back to random
    return rollRandom(songs, count);
  }

  return rollRandom(nicheSongs, count);
}

/** Calculate how many seeds to use for a desired output count */
export function calculateSeedCount(desiredOutput: number): number {
  return Math.ceil((desiredOutput / 10) * 1.5);
}

/** Roll seeds based on mode */
export function rollSeeds(songs: Song[], desiredOutput: number, mode: DiceMode): Song[] {
  const seedCount = calculateSeedCount(desiredOutput);

  switch (mode) {
    case "deep":
      return rollDeep(songs, seedCount);
    case "random":
    default:
      return rollRandom(songs, seedCount);
  }
}
