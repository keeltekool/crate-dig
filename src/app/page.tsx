import { VinylRecord } from "@/components/vinyl-record";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const session = await getSession();

  // If already connected, go straight to roll
  if (session.connected) {
    redirect("/roll");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-[600px] w-full flex flex-col items-center text-center gap-8">
        {/* Hero vinyl */}
        <VinylRecord size={160} spinning={true} />

        {/* Title */}
        <div>
          <h1 className="text-[64px] leading-none tracking-[6px] font-display">
            <span className="text-white">CRATE</span>
            <span className="text-orange-500">DIG</span>
          </h1>
          <p className="text-neutral-500 font-mono text-sm mt-2 tracking-wider">
            Dig deeper into your collection
          </p>
        </div>

        {/* Description */}
        <p className="text-neutral-400 font-mono text-sm leading-relaxed max-w-md">
          Upload your DJ library. Roll the dice. Let YouTube Music find tracks
          you&apos;ve never heard — seeded by songs you already love.
        </p>

        {/* Connect CTA */}
        <Link
          href="/api/youtube/connect"
          className="bg-orange-500 hover:bg-orange-600 text-black font-display text-xl tracking-[3px] px-8 py-3 transition-all hover:shadow-[0_0_30px_rgba(249,115,22,0.2)]"
        >
          CONNECT YOUTUBE
        </Link>

        <p className="text-neutral-600 text-xs font-mono">
          Sign in with Google to connect your YouTube Music account
        </p>
      </div>
    </main>
  );
}
