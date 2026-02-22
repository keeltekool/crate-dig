"use client";

interface VinylRecordProps {
  size?: number;
  spinning?: boolean;
  fast?: boolean;
  className?: string;
}

export function VinylRecord({ size = 120, spinning = true, fast = false, className = "" }: VinylRecordProps) {
  const animClass = spinning ? (fast ? "animate-vinyl-fast" : "animate-vinyl-spin") : "";

  return (
    <div
      className={`rounded-full border border-vinyl-groove flex-shrink-0 ${animClass} ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, #1a1a1a 20%, #111 21%, #111 40%, #1a1a1a 41%, #1a1a1a 42%, #111 43%, #111 60%, #0a0a0a 61%)`,
        position: "relative",
      }}
    >
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500"
        style={{ width: size * 0.22, height: size * 0.22 }}
      />
    </div>
  );
}
