import React from 'react';

/**
 * Standard utilitarian text input.
 */
export default function Input({
  className = '',
  error = false,
  ...props
}) {
  return (
    <input
      className={`w-full h-9 px-3 text-sm text-slate-900 bg-white border ${
        error ? 'border-rose-400 focus:border-rose-600 focus:ring-rose-600' : 'border-slate-300 focus:border-blue-600 focus:ring-blue-600'
      } rounded-[6px] placeholder:text-slate-400 focus:outline-none focus:ring-1 transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${className}`}
      {...props}
    />
  );
}

