import React from 'react';

export default function Checkbox({
  id,
  label,
  checked,
  onChange,
  disabled = false,
  description = null,
  className = '',
  ...props
}) {
  return (
    <label
      htmlFor={id}
      className={`inline-flex items-start gap-2.5 cursor-pointer select-none text-xs text-slate-700 ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
    >
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="w-4 h-4 mt-0.5 rounded-[4px] border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
        {...props}
      />
      <div>
        <span className="font-medium text-slate-800">{label}</span>
        {description && (
          <p className="text-slate-500 text-[11px] mt-0.5">{description}</p>
        )}
      </div>
    </label>
  );
}

