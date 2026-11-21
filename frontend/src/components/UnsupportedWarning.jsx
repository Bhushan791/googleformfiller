import React, { useState } from 'react';
import Alert from './ui/Alert';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Warning alert shown when the form has unsupported questions (e.g. file upload, grid).
 * Collapsed by default as requested.
 */
export default function UnsupportedWarning({ items = [] }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!items?.length) return null;

  return (
    <div className="w-full">
      <Alert
        variant="warning"
        title={`${items.length} unsupported question${items.length !== 1 ? 's' : ''} will be skipped`}
      >
        <div className="mt-1">
          <p className="text-xs text-amber-800">
            Certain fields (such as file uploads or matrix grids) cannot be automated safely.
          </p>

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-900 hover:underline cursor-pointer"
          >
            <span>{isOpen ? 'Hide skipped items' : 'View skipped items'}</span>
            {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {isOpen && (
            <ul className="mt-2 space-y-1.5 border-t border-amber-200/60 pt-2">
              {items.map((item, i) => (
                <li key={i} className="text-xs text-amber-900 flex items-start gap-1.5">
                  <span className="font-mono text-[10px] text-amber-700 mt-0.5">•</span>
                  <span>
                    <strong className="font-medium">{item.title || 'Untitled'}</strong>
                    {item.reason && <span className="text-amber-700"> — {item.reason}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Alert>
    </div>
  );
}
