CREATE TABLE "libraries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" text NOT NULL,
	"songs" jsonb NOT NULL,
	"song_count" integer NOT NULL,
	"artist_count" integer NOT NULL,
	"uploaded_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rolls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dice_mode" text NOT NULL,
	"output_size" integer NOT NULL,
	"seeds_used" integer NOT NULL,
	"seeds_failed" integer DEFAULT 0,
	"tracks_found" integer NOT NULL,
	"playlist_id" text,
	"playlist_url" text,
	"thumbnail_url" text,
	"rolled_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "youtube_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_email" text,
	"oauth_token" jsonb NOT NULL,
	"connected_at" timestamp DEFAULT now(),
	"last_used_at" timestamp DEFAULT now()
);
