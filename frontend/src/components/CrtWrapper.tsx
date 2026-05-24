import React from 'react';

interface CrtWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export const CrtWrapper: React.FC<CrtWrapperProps> = ({ children, className = '' }) => {
  return (
    <div className={`min-h-screen relative w-full bg-cyber-bg text-gray-200 overflow-hidden font-sans crt-screen scanline cyber-grid ${className}`}>
      
      {/* Absolute floating cyber corner design decals */}
      <div className="absolute top-4 left-4 z-50 pointer-events-none hidden md:block">
        <div className="text-[10px] font-mono text-cyber-green opacity-40">SYS_SEC: ACTIVE_GRD // SECURE_PORTAL_2026</div>
      </div>
      <div className="absolute top-4 right-4 z-50 pointer-events-none hidden md:block">
        <div className="text-[10px] font-mono text-cyber-green opacity-40">NODE_ADR: 192.168.80.12 // RISK_LEV: EXC</div>
      </div>

      {/* Screen CRT Flicker and Glare filter overlays */}
      <div className="absolute inset-0 bg-transparent pointer-events-none crt-flicker z-40 opacity-[0.02]" />
      
      <div className="relative z-30 min-h-screen flex flex-col">
        {children}
      </div>

      {/* Retro Phosphor green glow in vignette */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_40%,rgba(3,7,18,0.85)_100%)] z-20" />
    </div>
  );
};
