import React from 'react';
import HealthBadge from './HealthBadge';

export default function Header({ onNavigateHome }) {
  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 select-none">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <button
          type="button"
          onClick={onNavigateHome}
          className="flex items-center hover:opacity-90 transition-opacity text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded py-1"
          aria-label="Autofillr - Back to start"
        >
          <img
            src="/logo.png"
            alt="Autofillr logo"
            className="h-10 sm:h-11 w-auto object-contain"
          />
          <span className="sr-only">Autofillr</span>
        </button>

        {/* API status pill */}
        <HealthBadge />
      </div>
    </header>
  );
}
