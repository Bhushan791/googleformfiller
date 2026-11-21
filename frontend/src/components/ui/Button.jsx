import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Utilitarian, prop-driven Button component.
 * Variants: primary, secondary, ghost, danger
 * Sizes: sm (32px), md (36px, default), lg (40px)
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  icon: Icon = null,
  ...props
}) {
  const base =
    'inline-flex items-center justify-center font-medium transition-colors select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none rounded-[6px]';

  const variants = {
    primary:
      'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-none border border-transparent',
    secondary:
      'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100',
    ghost:
      'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent',
    danger:
      'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 border border-transparent',
  };

  const sizes = {
    sm: 'h-8 px-2.5 text-xs gap-1.5',
    md: 'h-9 px-3.5 text-[13px] gap-2',
    lg: 'h-10 px-4 text-sm gap-2',
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
      ) : null}
      {children}
    </button>
  );
}
