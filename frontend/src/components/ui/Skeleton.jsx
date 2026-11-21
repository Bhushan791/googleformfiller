import React from 'react';

export default function Skeleton({ className = '', ...props }) {
  return (
    <div
      className={`animate-pulse bg-slate-200/70 rounded-[6px] ${className}`}
      {...props}
    />
  );
}

