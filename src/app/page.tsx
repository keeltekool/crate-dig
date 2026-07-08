import { VinylRecord } from "@/components/vinyl-record";
import { Logo } from "@/components/logo";
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
    <div className="min-h-screen bg-[#0A0A0A] text-[#E5E5E5]">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-[#1a1a1a] bg-[#0A0A0A]/85 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[960px] items-center justify-between px-5">
          <Logo compact />
          <Link
            href="/api/youtube/connect"
            className="bg-orange-500 px-4 py-2 font-display text-[15px] tracking-[2px] text-black transition-colors hover:bg-orange-400"
          >
            CONNECT
          </Link>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="px-5 pt-20 pb-16 text-center">
        <div className="mx-auto flex max-w-[640px] flex-col items-center">
          <VinylRecord size={150} spinning={true} />
          <h1 className="mt-10 font-display text-[64px] leading-[0.9] tracking-[4px] sm:text-[80px]">
            <span className="text-white">DIG DEEPER INTO</span><br />
            <span className="text-orange-500">YOUR COLLECTION</span>
          </h1>
          <p className="mt-6 max-w-md font-mono text-sm leading-relaxed text-[#A3A3A3]">
            Upload your DJ library. Roll the dice. Let YouTube Music surface tracks
            you&apos;ve never heard — seeded by the songs you already love.
          </p>
          <div className="mt-9 flex flex-col items-center gap-4">
            <Link
              href="/api/youtube/connect"
              className="bg-orange-500 px-10 py-4 font-display text-xl tracking-[4px] text-black transition-all hover:bg-orange-400 hover:shadow-[0_0_40px_rgba(249,115,22,0.25)]"
            >
              CONNECT YOUTUBE
            </Link>
            <p className="font-mono text-xs text-[#555]">
              Sign in with Google · Powered by YouTube Music
            </p>
          </div>
        </div>
      </section>

      {/* ── Product showcase — the actual roll ──────────────────────────── */}
      <section className="px-5 pb-20">
        <div className="mx-auto max-w-[560px]">
          <SectionLabel>The roll</SectionLabel>
          <div className="mt-4 rounded-xl border border-[#222] bg-[#111] p-6">
            {/* Dice modes */}
            <div className="flex flex-wrap justify-center gap-2">
              <DiceChip emoji="🎲" label="RANDOM" active />
              <DiceChip emoji="🎯" label="GENRE" />
              <DiceChip emoji="⏰" label="ERA" />
              <DiceChip emoji="🔥" label="DEEP" />
            </div>

            {/* Slider */}
            <p className="mt-7 text-center font-mono text-[11px] uppercase tracking-[2px] text-[#555]">
              Output: 50 tracks
            </p>
            <div className="relative mx-auto mt-3 h-1 w-[80%] rounded-full bg-[#333]">
              <div className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-orange-500" />
              <div className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0A0A0A] bg-orange-500" />
            </div>

            {/* Roll button */}
            <div className="mt-7 flex justify-center">
              <span className="inline-block bg-orange-500 px-12 py-3.5 font-display text-xl tracking-[4px] text-black">
                🎲 ROLL THE DICE
              </span>
            </div>

            {/* Preview */}
            <div className="mt-7 border-t border-[#1a1a1a] pt-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-[13px] text-[#888]">Preview</span>
                <span className="font-mono text-[11px] text-[#555]">50 tracks · 8 seeds</span>
              </div>
              <TrackRow n="01" artist="Khruangbin" title="Maria También" />
              <TrackRow n="02" artist="Toro y Moi" title="Ordinary Pleasure" />
              <TrackRow n="03" artist="Nujabes" title="Feather ft. Cise Starr" />
              <TrackRow n="04" artist="Men I Trust" title="Show Me How" />
              <TrackRow n="05" artist="Mildlife" title="Vapour" last />
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section className="border-t border-[#1a1a1a] px-5 py-20">
        <div className="mx-auto max-w-[960px]">
          <SectionLabel center>How it works</SectionLabel>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            <Step n="01" title="UPLOAD YOUR CRATE" desc="Drop your library CSV — artist and title, that's all we need. Ten thousand tracks or ten, it's your crate." />
            <Step n="02" title="ROLL THE DICE" desc="Pick a mode — random, genre, era, or deep cuts — and roll. Your own tracks seed a search for things you've never heard." />
            <Step n="03" title="PUSH TO YOUTUBE" desc="Preview the picks, drop the ones you don't want, and push the rest straight to a new YouTube Music playlist." />
          </div>
        </div>
      </section>

      {/* ── Dice modes ──────────────────────────────────────────────────── */}
      <section className="border-t border-[#1a1a1a] px-5 py-20">
        <div className="mx-auto max-w-[960px]">
          <SectionLabel center>Four ways to dig</SectionLabel>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ModeCard emoji="🎲" name="RANDOM" desc="Pure chance. Seeds pulled at random from across your whole crate." />
            <ModeCard emoji="🎯" name="GENRE" desc="Locks onto your dominant genre and digs sideways within it." />
            <ModeCard emoji="⏰" name="ERA" desc="Seeds from a chosen decade — chase a specific sound in time." />
            <ModeCard emoji="🔥" name="DEEP" desc="Pulls your least-played, most obscure tracks for the real deep cuts." />
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <section className="border-t border-[#1a1a1a] px-5 py-24 text-center">
        <div className="mx-auto flex max-w-[560px] flex-col items-center">
          <VinylRecord size={96} spinning={true} />
          <h2 className="mt-8 font-display text-[52px] leading-none tracking-[4px] text-white sm:text-[64px]">
            READY TO <span className="text-orange-500">DIG?</span>
          </h2>
          <Link
            href="/api/youtube/connect"
            className="mt-8 bg-orange-500 px-10 py-4 font-display text-xl tracking-[4px] text-black transition-all hover:bg-orange-400 hover:shadow-[0_0_40px_rgba(249,115,22,0.25)]"
          >
            CONNECT YOUTUBE
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#1a1a1a] px-5 py-8">
        <div className="mx-auto flex max-w-[960px] flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <Logo compact />
          <p className="font-mono text-[11px] text-[#555]">Powered by YouTube Music</p>
        </div>
      </footer>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function SectionLabel({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <p className={`flex items-center gap-3 font-mono text-[10px] font-bold uppercase tracking-[3px] text-[#555] ${center ? "justify-center" : ""}`}>
      <span className="h-px w-6 bg-[#333]" />
      {children}
    </p>
  );
}

function DiceChip({ emoji, label, active }: { emoji: string; label: string; active?: boolean }) {
  return (
    <span
      className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 font-mono text-[11px] font-bold uppercase ${
        active
          ? "border-orange-500 bg-orange-500 text-black"
          : "border-[#333] bg-[#111] text-[#888]"
      }`}
    >
      {emoji} {label}
    </span>
  );
}

function TrackRow({ n, artist, title, last }: { n: string; artist: string; title: string; last?: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-2.5 ${last ? "" : "border-b border-[#111]"}`}>
      <span className="font-mono text-[11px] text-[#333]">{n}</span>
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-[#1a1a1a] text-sm">🎵</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-[13px] font-semibold text-orange-500">{artist}</p>
        <p className="truncate font-mono text-[13px] text-[#CCC]">{title}</p>
      </div>
      <span className="font-mono text-base text-[#333]">×</span>
    </div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div>
      <span className="font-mono text-[13px] font-bold text-orange-500">{n}</span>
      <h3 className="mt-3 font-display text-2xl tracking-[2px] text-white">{title}</h3>
      <p className="mt-2 font-mono text-[13px] leading-relaxed text-[#A3A3A3]">{desc}</p>
    </div>
  );
}

function ModeCard({ emoji, name, desc }: { emoji: string; name: string; desc: string }) {
  return (
    <div className="rounded-xl border border-[#222] bg-[#111] p-5 transition-colors hover:border-orange-500/40">
      <div className="text-2xl">{emoji}</div>
      <h3 className="mt-3 font-display text-xl tracking-[2px] text-orange-500">{name}</h3>
      <p className="mt-2 font-mono text-[12px] leading-relaxed text-[#A3A3A3]">{desc}</p>
    </div>
  );
}
