import React from 'react';

interface CrateDigLogoProps {
  variant?: 'full' | 'compact' | 'icon';
  className?: string;
}

export const CrateDigLogo: React.FC<CrateDigLogoProps> = ({
  variant = 'full',
  className = '',
}) => {
  const VinylIcon = ({ s = 36 }: { s?: number }) => (
    <div
      className="rounded-full border border-[#333] flex-shrink-0 animate-[spin_8s_linear_infinite]"
      style={{
        width: s,
        height: s,
        background: `radial-gradient(circle, #1a1a1a 20%, #111 21%, #111 40%, #1a1a1a 41%, #1a1a1a 42%, #111 43%, #111 60%, #0a0a0a 61%)`,
        position: 'relative',
      }}
    >
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500"
        style={{ width: s * 0.22, height: s * 0.22 }}
      />
    </div>
  );

  if (variant === 'icon') return <VinylIcon s={40} />;

  const textSize = variant === 'compact' ? 'text-[22px]' : 'text-[28px]';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <VinylIcon s={variant === 'compact' ? 30 : 36} />
      <span
        className={`${textSize} tracking-[3px]`}
        style={{ fontFamily: "'Bebas Neue', sans-serif" }}
      >
        <span className="text-white">CRATE</span>
        <span className="text-orange-500">DIG</span>
      </span>
    </div>
  );
};

export default CrateDigLogo;
