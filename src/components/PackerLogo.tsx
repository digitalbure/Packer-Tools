import React from 'react';

interface PackerLogoProps {
  variant?: 'full' | 'symbol-only' | 'text-only' | 'app-icon';
  size?: number; // Target height/width for symbol
  className?: string;
  light?: boolean; // If true, rendering is optimized for white background/text
  monoColor?: string; // Optional single ink/text color override for labels/stickers
}

export default function PackerLogo({ variant = 'full', size = 44, className = '', light = false, monoColor }: PackerLogoProps) {
  // Orange highlights: #FF5500 (Vibrant flight-case/hazard orange)
  // Dark parts: slate & charcoal grey (#1E1F22, #2D2F34, #404249)
  
  const isMono = !!monoColor;
  
  const orangePrimary = isMono ? monoColor : '#FF5500';
  const orangeShadow = isMono ? monoColor : '#CC4400';
  const orangeHighlight = isMono ? monoColor : '#FF7733';
  
  const greyDark = isMono ? monoColor : '#212224';
  const greyMedium = isMono ? monoColor : '#383A3F';
  const greyLight = isMono ? monoColor : '#53565C';

  // Responsive SVG Symbol
  const renderSymbol = () => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      {/* --- CUBE LEFT FACET: THREE RACK SLABS --- */}
      {/* Slab 1 (Leftmost Column) */}
      {/* Top Cap */}
      <polygon
        points="42,75 54,68 66,75 54,82"
        fill={greyLight}
        opacity={isMono ? 0.75 : undefined}
      />
      {/* Front Face */}
      <polygon
        points="42,75 54,82 54,135 42,128"
        fill={greyDark}
        opacity={isMono ? 0.4 : undefined}
      />
      {/* Right/Side shadow of slab 1 */}
      <polygon
        points="54,82 66,75 66,128 54,135"
        fill={greyMedium}
        opacity={isMono ? 0.55 : undefined}
      />
      {/* Indicator LED / Latch (Vibrant Orange Square) */}
      <polygon
        points="46,84 50,81 50,87 46,90"
        fill={orangePrimary}
      />

      {/* Slab 2 (Middle Column) */}
      {/* Top Cap */}
      <polygon
        points="57,84 69,77 81,84 69,91"
        fill={greyLight}
        opacity={isMono ? 0.75 : undefined}
      />
      {/* Front Face */}
      <polygon
        points="57,84 69,91 69,144 57,137"
        fill={greyDark}
        opacity={isMono ? 0.4 : undefined}
      />
      {/* Right side shadow */}
      <polygon
        points="69,91 81,84 81,137 69,144"
        fill={greyMedium}
        opacity={isMono ? 0.55 : undefined}
      />
      {/* Indicator LED */}
      <polygon
        points="61,93 65,90 65,96 61,99"
        fill={orangePrimary}
      />

      {/* Slab 3 (Rightmost Rack Column) */}
      {/* Top Cap */}
      <polygon
        points="72,93 84,86 96,93 84,100"
        fill={greyLight}
        opacity={isMono ? 0.75 : undefined}
      />
      {/* Front Face */}
      <polygon
        points="72,93 84,100 84,153 72,146"
        fill={greyDark}
        opacity={isMono ? 0.4 : undefined}
      />
      {/* Right side shadow */}
      <polygon
        points="84,100 96,93 96,146 84,153"
        fill={greyMedium}
        opacity={isMono ? 0.55 : undefined}
      />
      {/* Indicator LED */}
      <polygon
        points="76,102 80,99 80,105 76,108"
        fill={orangePrimary}
      />


      {/* --- CUBE RIGHT FACET: ORANGE ISOMETRIC 'P' WRAPPER --- */}
      {/* Front Stem (Leftmost face of the orange P column) */}
      <polygon
        points="99,102 111,109 111,162 99,155"
        fill={orangeShadow}
        opacity={isMono ? 0.5 : undefined}
      />
      
      {/* Right stem face */}
      <polygon
        points="111,109 123,102 123,155 111,162"
        fill={orangeHighlight}
        opacity={isMono ? 0.9 : undefined}
      />
      
      {/* Top cap of the front vertical orange post */}
      <polygon
        points="99,102 111,95 123,102 111,109"
        fill={orangePrimary}
        opacity={isMono ? 1.0 : undefined}
      />

      {/* Top Loop section of P (extending further up & back) */}
      {/* Horizontal connector extending to the right */}
      <polygon
        points="111,95 123,88 135,95 123,102"
        fill={orangePrimary}
        opacity={isMono ? 1.0 : undefined}
      />
      
      {/* Large right loop panel of the P */}
      <polygon
        points="123,102 153,85 153,115 123,132"
        fill={orangeHighlight}
        opacity={isMono ? 0.9 : undefined}
      />
      <polygon
        points="111,109 123,102 123,132 111,139"
        fill={orangeShadow}
        opacity={isMono ? 0.5 : undefined}
      />
      
      {/* Inner loop hollow carve out shadow (creates depth inside the P) */}
      <polygon
        points="123,102 138,93 138,103 123,112"
        fill={isMono ? monoColor : '#9E3300'}
        opacity={isMono ? 0.3 : undefined}
      />

      {/* Extreme top-right cap of the loop */}
      <polygon
        points="123,88 135,81 153,92 135,100"
        fill={orangePrimary}
        opacity={isMono ? 1.0 : undefined}
      />
      
      {/* Bottom loop closure (extending back to the stem) */}
      <polygon
        points="123,124 153,107 153,115 123,132"
        fill={orangeShadow}
        opacity={isMono ? 0.5 : undefined}
      />
    </svg>
  );

  // Responsive Text Logotype
  const renderText = () => {
    const mainTextColor = isMono ? monoColor : (light ? 'text-neutral-900' : 'text-white');
    const dotAndToolsColor = isMono ? monoColor : '#FF5500';
    
    return (
      <div className="flex items-center select-none font-sans">
        <span 
          className={`text-[1.25rem] font-extrabold uppercase tracking-[0.2em]`} 
          style={isMono ? { color: mainTextColor } : undefined}
        >
          PACKER
        </span>
        <span 
          className="text-[1.25rem] font-extrabold mx-0.5 animate-pulse text-[#FF5500]"
          style={isMono ? { color: dotAndToolsColor } : undefined}
        >
          .
        </span>
        <span 
          className="text-[1.25rem] font-extrabold uppercase tracking-[0.2em] text-[#FF5500]"
          style={isMono ? { color: dotAndToolsColor } : undefined}
        >
          TOOLS
        </span>
      </div>
    );
  };

  if (variant === 'symbol-only') {
    return (
      <div className={`inline-flex items-center justify-center p-1.5 ${className}`}>
        {renderSymbol()}
      </div>
    );
  }

  if (variant === 'app-icon') {
    return (
      <div className={`w-14 h-14 bg-[#0D0D0D] border border-neutral-800 rounded-2xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform ${className}`}>
        {renderSymbol()}
      </div>
    );
  }

  if (variant === 'text-only') {
    return renderText();
  }

  // Defaut: 'full'
  return (
    <div className={`flex items-center gap-3.5 ${className}`}>
      {renderSymbol()}
      {renderText()}
    </div>
  );
}
