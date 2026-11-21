import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

export default function Alert({
  variant = 'info',
  title = null,
  children,
  className = '',
  ...props
}) {
  const icons = {
    info: Info,
    warning: AlertTriangle,
    error: AlertCircle,
    success: CheckCircle2,
  };

  const variants = {
    info: 'bg-blue-50/60 border-blue-200 text-blue-900',
    warning: 'bg-amber-50/60 border-amber-200 text-amber-900',
    error: 'bg-rose-50/60 border-rose-200 text-rose-900',
    success: 'bg-emerald-50/60 border-emerald-200 text-emerald-900',
  };

  const iconColors = {
    info: 'text-blue-600',
    warning: 'text-amber-600',
    error: 'text-rose-600',
    success: 'text-emerald-600',
  };

  const IconComponent = icons[variant] || Info;

  return (
    <div
      role="alert"
      className={`border rounded-[6px] p-3 text-xs flex items-start gap-2.5 ${
        variants[variant] || variants.info
      } ${className}`}
      {...props}
    >
      <IconComponent
        className={`w-4 h-4 shrink-0 mt-0.5 ${iconColors[variant] || iconColors.info}`}
        strokeWidth={1.75}
      />
      <div className="flex-1">
        {title && <h4 className="font-semibold mb-0.5">{title}</h4>}
        <div className="text-slate-700 leading-normal">{children}</div>
      </div>
    </div>
  );
}

