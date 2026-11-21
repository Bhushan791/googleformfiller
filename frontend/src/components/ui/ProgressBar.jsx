import React from 'react';

export default function ProgressBar({
  value = 0,
  max = 100,
  className = '',
  barClassName = 'bg-blue-600',
  ...props
}) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div
      className={`w-full h-1.5 bg-slate-100 rounded-full overflow-hidden ${className}`}
      {...props}
    >
      <div
        className={`h-full transition-all duration-300 ease-out ${barClassName}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

