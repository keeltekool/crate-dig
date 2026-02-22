import { pgTable, uuid, text, jsonb, integer, timestamp } from "drizzle-orm/pg-core";

export const libraries = pgTable("libraries", {
  id: uuid("id").primaryKey().defaultRandom(),
  filename: text("filename").notNull(),
  songs: jsonb("songs").notNull().$type<Array<{ artist: string; title: string; genre?: string }>>(),
  songCount: integer("song_count").notNull(),
  artistCount: integer("artist_count").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const youtubeConnections = pgTable("youtube_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  googleEmail: text("google_email"),
  oauthToken: jsonb("oauth_token").notNull().$type<{
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_at: number;
    client_id: string;
    client_secret: string;
  }>(),
  connectedAt: timestamp("connected_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at").defaultNow(),
});

export const rolls = pgTable("rolls", {
  id: uuid("id").primaryKey().defaultRandom(),
  diceMode: text("dice_mode").notNull(), // 'random' | 'deep'
  outputSize: integer("output_size").notNull(),
  seedsUsed: integer("seeds_used").notNull(),
  seedsFailed: integer("seeds_failed").default(0),
  tracksFound: integer("tracks_found").notNull(),
  playlistId: text("playlist_id"),
  playlistUrl: text("playlist_url"),
  thumbnailUrl: text("thumbnail_url"),
  rolledAt: timestamp("rolled_at").defaultNow(),
});
