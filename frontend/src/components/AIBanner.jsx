import { useEffect, useState } from 'react';
import client from '../api/client';

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
    <div className="w-full bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs text-amber-800 flex items-center justify-center gap-1.5 font-medium">
      <span>AI off: add GEMINI_KEY or GROQ_KEY to the backend .env</span>
    </div>
  );
}

