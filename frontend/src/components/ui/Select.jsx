import React from 'react';

export default function Select({
  options = [],
  className = '',
  ...props
}) {
  return (
    <select
      className={`h-9 px-2.5 text-xs text-slate-900 bg-white border border-slate-300 rounded-[6px] focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-colors cursor-pointer disabled:bg-slate-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

