import React from 'react';

export default function Slider({
  min = 0,
  max = 100,
  step = 1,
  value,
  onChange,
  className = '',
  ...props
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={onChange}
      className={`w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 ${className}`}
      {...props}
    />
  );
}

