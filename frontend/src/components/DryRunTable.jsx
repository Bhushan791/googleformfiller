import React, { useState, useEffect, useRef } from 'react';
import { RotateCw, Info, Sparkles, X, CheckCircle2, ChevronRight } from 'lucide-react';
import Button from './ui/Button';
import Badge from './ui/Badge';

const SENTIMENT_BADGES = {
  positive: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  negative: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function DryRunTable({
  responses = [],
  questions = [],
  metadata = {},
  onRegenerate,
  loading = false,
}) {
  const [selectedResponse, setSelectedResponse] = useState(null);
  const detailDrawerRef = useRef(null);

  // Esc closes response detail drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedResponse(null);
    };
    if (selectedResponse) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedResponse]);

  return (
    <div className="w-full space-y-4">
      {/* Header Row: Title, Regenerate button, AI source note */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">Dry Run Preview</h3>
            <Badge variant="info">5 Samples</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {metadata?.fallbackUsed ? (
              <span className="text-amber-700 font-medium">
                Source: Basic templates (LLM key not configured or unavailable)
              </span>
            ) : (
              <span className="text-emerald-700 font-medium">
                Source: Dynamic AI generation
              </span>
            )}
          </p>
        </div>

        {onRegenerate && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onRegenerate}
            loading={loading}
            icon={RotateCw}
          >
            Regenerate Sample
          </Button>
        )}
      </div>

      {/* Fallback Notice Banner if applicable */}
      {metadata?.fallbackUsed && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.75} />
          <div>
            <span className="font-semibold">Local Template Engine Active:</span> Answers generated using heuristic pattern-matching. Add <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-[11px]">GROQ_KEY</code> or <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-[11px]">OPENROUTER_KEY</code> to enable LLM contextual answers.
          </div>
        </div>
      )}

      {/* Table Container: Horizontal scroll only inside table container */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-none">
        <div className="overflow-x-auto max-w-full">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-semibold select-none">
              <tr>
                {/* Sticky first column */}
                <th
                  scope="col"
                  className="sticky left-0 z-20 bg-slate-50 px-3 py-2.5 whitespace-nowrap w-16 text-center border-r border-slate-200 shadow-[1px_0_0_0_rgba(226,232,240,1)]"
                >
                  #
                </th>
                <th scope="col" className="px-3 py-2.5 whitespace-nowrap w-24">
                  Sentiment
                </th>
                {questions.map((q, idx) => (
                  <th
                    key={q.entryId || idx}
                    scope="col"
                    className="px-3 py-2.5 whitespace-nowrap max-w-[200px] truncate"
                    title={q.title}
                  >
                    {q.title || `Q${idx + 1}`}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2.5 text-right w-16">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {responses.map((resp, rIdx) => {
                const badgeClass =
                  SENTIMENT_BADGES[resp.sentiment] || SENTIMENT_BADGES.neutral;

                return (
                  <tr
                    key={resp.index ?? rIdx}
                    onClick={() => setSelectedResponse({ ...resp, rowNum: rIdx + 1 })}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    {/* Sticky first column */}
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50/80 px-3 py-2.5 text-center font-mono text-slate-500 border-r border-slate-200 font-medium">
                      {rIdx + 1}
                    </td>

                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium border capitalize ${badgeClass}`}
                      >
                        {resp.sentiment}
                      </span>
                    </td>

                    {questions.map((q, qIdx) => {
                      const ans = resp.answers ? resp.answers[q.entryId] : undefined;
                      let displayAns = '—';
                      if (ans !== undefined && ans !== null && ans !== '') {
                        displayAns = Array.isArray(ans) ? ans.join(', ') : String(ans);
                      }

                      return (
                        <td
                          key={q.entryId || qIdx}
                          className="px-3 py-2.5 text-slate-700 max-w-[220px] truncate"
                          title={displayAns}
                        >
                          {displayAns}
                        </td>
                      );
                    })}

                    <td className="px-3 py-2.5 text-right">
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 inline" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 text-right">
        Tip: Click any row to view full responses in a side drawer.
      </p>

      {/* Response Detail Drawer */}
      {selectedResponse && (
        <div
          className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-[2px] flex justify-end animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedResponse(null)}
        >
          <div
            ref={detailDrawerRef}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col focus:outline-none animate-in slide-in-from-right duration-200"
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Sample Response #{selectedResponse.rowNum}
                  </span>
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium border capitalize ${
                      SENTIMENT_BADGES[selectedResponse.sentiment] || SENTIMENT_BADGES.neutral
                    }`}
                  >
                    {selectedResponse.sentiment}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-slate-900 mt-1">
                  Full Submission Breakdown
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedResponse(null)}
                className="rounded-md p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {questions.map((q, idx) => {
                const ans = selectedResponse.answers ? selectedResponse.answers[q.entryId] : undefined;
                let displayAns = '—';
                if (ans !== undefined && ans !== null && ans !== '') {
                  displayAns = Array.isArray(ans) ? ans.join(', ') : String(ans);
                }

                return (
                  <div key={q.entryId || idx} className="p-3 rounded-md bg-slate-50 border border-slate-200 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-slate-800">
                        {idx + 1}. {q.title}
                      </span>
                      <Badge variant="neutral" className="text-[10px] shrink-0">
                        {q.type}
                      </Badge>
                    </div>
                    {q.helpText && (
                      <p className="text-[11px] text-slate-400">{q.helpText}</p>
                    )}
                    <div className="mt-1.5 pt-1.5 border-t border-slate-200/60 font-mono text-slate-900 text-xs break-words">
                      {displayAns}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setSelectedResponse(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
