import React from 'react';
import HealthBadge from './HealthBadge';

export default function Header() {
  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 select-none">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-[4px] bg-blue-600 flex items-center justify-center text-white text-[11px] font-bold tracking-tight">
            F
          </div>
          <span className="text-sm font-semibold tracking-tight text-slate-900">
            Form Auto Filler
          </span>
          <span className="hidden sm:inline-block text-[11px] text-slate-400 font-mono border border-slate-200 rounded px-1.5 py-0.2">
            v1.0
          </span>
        </div>

        {/* Status indicator */}
        <HealthBadge />
      </div>
    </header>
  );
}
