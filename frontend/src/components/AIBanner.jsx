import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { AlertTriangle } from 'lucide-react';

export default function AIBanner() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let mounted = true;
    client
      .get('/api/llm/status')
      .then((res) => {
        if (mounted && res.data?.data?.enabled === false) {
          setEnabled(false);
        }
      })
      .catch(() => {
        // Do not display if backend is unreachable or still starting
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (enabled) return null;

  return (
    <div className="w-full bg-amber-50/80 border-b border-amber-200 px-4 py-1.5 text-center text-xs text-amber-800 flex items-center justify-center gap-2 font-medium">
      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" strokeWidth={1.75} />
      <span>AI off: add GROQ_KEY or OPENROUTER_KEY to the backend .env</span>
    </div>
  );
}
