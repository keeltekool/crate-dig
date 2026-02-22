import { VinylRecord } from "./vinyl-record";

interface LogoProps {
  compact?: boolean;
  className?: string;
}

export function Logo({ compact = false, className = "" }: LogoProps) {
  const textSize = compact ? "text-[22px]" : "text-[28px]";
  const vinylSize = compact ? 30 : 36;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <VinylRecord size={vinylSize} spinning={true} />
      <span className={`${textSize} tracking-[3px] font-display`}>
        <span className="text-white">CRATE</span>
        <span className="text-orange-500">DIG</span>
      </span>
    </div>
  );
}
