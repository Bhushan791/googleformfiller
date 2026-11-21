import React from 'react';
import useHealth from '../hooks/useHealth';

const STATUS_CONFIG = {
  online: {
    label: 'API Online',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-slate-50 border-slate-200 text-slate-700',
  },
  waking: {
    label: 'Connecting…',
    dotClass: 'bg-amber-400 animate-pulse',
    badgeClass: 'bg-amber-50/50 border-amber-200 text-amber-800',
  },
  offline: {
    label: 'API Offline',
    dotClass: 'bg-rose-500',
    badgeClass: 'bg-rose-50/50 border-rose-200 text-rose-800',
  },
};

export default function HealthBadge() {
  const { status, responseTime, checkNow } = useHealth();
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.offline;

  return (
    <button
      type="button"
      onClick={checkNow}
      title="Click to check API status"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium border rounded-full transition-colors cursor-pointer select-none ${config.badgeClass} hover:bg-slate-100`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dotClass}`} />
      <span>{config.label}</span>
      {responseTime !== null && (
        <span className="text-slate-400 font-mono text-[10px]">
          {responseTime}ms
        </span>
      )}
    </button>
  );
}
