import React from 'react';

export default function EmptyState({
  icon: Icon = null,
  title,
  description = null,
  action = null,
  className = '',
  ...props
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 bg-white border border-slate-200 rounded-[8px] ${className}`}
      {...props}
    >
      {Icon && (
        <div className="w-10 h-10 rounded-[6px] bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
          <Icon className="w-5 h-5" strokeWidth={1.75} />
        </div>
      )}
      <h4 className="text-sm font-semibold text-slate-900 tracking-tight">{title}</h4>
      {description && (
        <p className="text-xs text-slate-500 mt-1 max-w-sm leading-normal">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

