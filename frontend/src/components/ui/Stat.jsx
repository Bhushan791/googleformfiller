import React from 'react';

export default function Stat({
  label,
  value,
  subtext = null,
  className = '',
  ...props
}) {
  return (
    <div className={`flex flex-col ${className}`} {...props}>
      <span className="text-xs text-slate-500 font-medium">{label}</span>
      <span className="text-lg font-semibold text-slate-900 tracking-tight mt-0.5">
        {value}
      </span>
      {subtext && <span className="text-[11px] text-slate-400 mt-0.5">{subtext}</span>}
    </div>
  );
}

