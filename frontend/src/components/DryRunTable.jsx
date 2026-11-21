import React, { useState, useMemo } from 'react';
import { 
  RotateCw, 
  Copy, 
  LayoutGrid, 
  Table as TableIcon, 
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  Filter
} from 'lucide-react';
import Button from './ui/Button';
import Badge from './ui/Badge';
import Alert from './ui/Alert';
import Skeleton from './ui/Skeleton';
import EmptyState from './ui/EmptyState';
import { useToast } from './ui/Toast';

const SENTIMENT_BADGES = {
  positive: { variant: 'success', label: 'Positive' },
  neutral: { variant: 'neutral', label: 'Neutral' },
  negative: { variant: 'danger', label: 'Negative' },
};

function AnswerText({ text }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = (text || '').length > 180;

  if (!text) {
    return <span className="text-slate-400 italic text-xs">No response</span>;
  }

  return (
    <div className="space-y-1">
      <p className={`text-xs text-slate-900 leading-relaxed break-words ${expanded ? '' : 'line-clamp-4'}`}>
        {text}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] font-medium text-blue-600 hover:text-blue-800 cursor-pointer inline-flex items-center gap-0.5"
        >
          <span>{expanded ? 'Show less' : 'Show more'}</span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      )}
    </div>
  );
}

export default function DryRunTable({
  responses = [],
  questions = [],
  metadata = {},
  detectionInfo = null,
  onRegenerate,
  onBack,
  onContinue,
  loading = false,
  error = null,
}) {
  const { addToast } = useToast();
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [selectedSentiment, setSelectedSentiment] = useState('all'); // 'all' | 'positive' | 'neutral' | 'negative'
  const [textOnly, setTextOnly] = useState(false);

  // Filter questions if "Show only text answers" is checked
  const visibleQuestions = useMemo(() => {
    if (!textOnly) return questions;
    return questions.filter((q) => ['short_text', 'paragraph'].includes(q.type));
  }, [questions, textOnly]);

  // Filter responses by sentiment
  const filteredResponses = useMemo(() => {
    if (selectedSentiment === 'all') return responses;
    return responses.filter((r) => r.sentiment === selectedSentiment);
  }, [responses, selectedSentiment]);

  // Copy sample as CSV
  const handleCopyCsv = () => {
    if (!responses.length || !questions.length) return;
    try {
      const headers = ['#', 'Sentiment', ...questions.map((q) => `"${(q.title || '').replace(/"/g, '""')}"`)];
      const rows = responses.map((r, idx) => {
        const rowAns = questions.map((q) => {
          const val = r.answers ? r.answers[q.entryId] : '';
          const str = Array.isArray(val) ? val.join(', ') : (val ?? '');
          return `"${String(str).replace(/"/g, '""')}"`;
        });
        return [idx + 1, r.sentiment, ...rowAns].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      navigator.clipboard?.writeText(csvContent).then(() => {
        addToast('Sample data copied as CSV', 'success');
      }).catch(() => {
        addToast('Failed to copy to clipboard', 'error');
      });
    } catch {
      addToast('Error formatting CSV', 'error');
    }
  };

  const isFallback = metadata?.fallbackUsed || false;
  const detectedMode = detectionInfo?.detectedMode;
  const detectedConfidence = Math.round((detectionInfo?.confidence || 0) * 100);

  // Loading skeleton state
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="error" title="Preview Generation Failed">
          <p className="mt-1 text-xs text-rose-700">{error}</p>
          {onRegenerate && (
            <div className="mt-3">
              <Button type="button" variant="secondary" size="md" onClick={onRegenerate} icon={RotateCw}>
                Retry Generation
              </Button>
            </div>
          )}
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      {/* 1. Header row: Title, Source note, Audience badge, Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">
              Dry Run Preview
            </h3>
            <Badge variant="neutral" className="text-xs font-mono">
              {responses.length} {responses.length === 1 ? 'sample' : 'samples'}
            </Badge>

            {/* Detected Audience Mode Badge */}
            {detectedMode && (
              <Badge variant="info" className="text-xs">
                Audience: {detectedMode} ({detectedConfidence}%)
              </Badge>
            )}
          </div>

          <p className="text-xs text-slate-500">
            {isFallback ? (
              <span className="text-amber-700 font-medium">
                Source: Basic templates (local fallback)
              </span>
            ) : (
              <span className="text-emerald-700 font-medium">
                Source: AI contextual answers
              </span>
            )}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={handleCopyCsv}
            icon={Copy}
            title="Copy all sample responses as CSV"
          >
            Copy sample as CSV
          </Button>

          {onRegenerate && (
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onRegenerate}
              loading={loading}
              icon={RotateCw}
            >
              Regenerate
            </Button>
          )}
        </div>
      </div>

      {/* 2. Warning Alert when answers come from templates */}
      {isFallback && (
        <Alert variant="warning" title="Basic Templates Active">
          <p className="mt-0.5 text-xs text-amber-800 leading-relaxed">
            AI generation was unavailable or rate-limited. Answers were synthesized using local fallback template patterns. Add a valid <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-[11px]">GROQ_KEY</code> or <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-[11px]">OPENROUTER_KEY</code> to enable full LLM generation.
          </p>
        </Alert>
      )}

      {/* 3. Toolbar: View toggle (Cards | Table) + Filters (Sentiment + Text-only) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
        {/* Left: Sentiment Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Sentiment:
          </span>
          {['all', 'positive', 'neutral', 'negative'].map((sent) => {
            const isSelected = selectedSentiment === sent;
            return (
              <button
                key={sent}
                type="button"
                onClick={() => setSelectedSentiment(sent)}
                className={`px-2.5 py-1 text-xs rounded-md capitalize font-medium transition-colors cursor-pointer border ${
                  isSelected
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {sent}
              </button>
            );
          })}
        </div>

        {/* Right: Text-only toggle & View Switcher */}
        <div className="flex items-center gap-3">
          {/* Text-only toggle */}
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={textOnly}
              onChange={(e) => setTextOnly(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span>Show only text answers</span>
          </label>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* Cards | Table View Toggle */}
          <div className="inline-flex rounded-md border border-slate-200 p-0.5 bg-slate-100">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Main Preview Content: Cards View (Default) OR Table View */}
      {filteredResponses.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8">
          <EmptyState
            title="No responses match the filter"
            description="Try selecting a different sentiment filter or clearing 'Show only text answers'."
          />
        </div>
      ) : viewMode === 'cards' ? (
        /* RESPONSE CARDS GRID (1 col mobile, 2 col desktop) */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredResponses.map((resp, rIdx) => {
            const badgeCfg = SENTIMENT_BADGES[resp.sentiment] || SENTIMENT_BADGES.neutral;
            const originalIndex = responses.indexOf(resp) + 1;

            return (
              <div
                key={resp.index ?? rIdx}
                className="rounded-lg border border-slate-200 bg-white p-4 space-y-3.5 hover:border-slate-300 transition-colors shadow-none"
              >
                {/* Card Header: Response #N + Sentiment Badge */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-900">
                      Response #{originalIndex}
                    </span>
                  </div>
                  <Badge variant={badgeCfg.variant} className="text-[11px] capitalize">
                    {badgeCfg.label}
                  </Badge>
                </div>

                {/* Compact list of Question: Answer rows */}
                <div className="space-y-3">
                  {visibleQuestions.map((q, qIdx) => {
                    const ans = resp.answers ? resp.answers[q.entryId] : undefined;
                    const isText = ['short_text', 'paragraph'].includes(q.type);
                    const formattedAns = Array.isArray(ans) ? ans.join(', ') : (ans ?? '');

                    return (
                      <div key={q.entryId || qIdx} className="space-y-1">
                        <span
                          className="text-xs font-semibold text-slate-700 truncate block"
                          title={q.title}
                        >
                          {q.title || `Question ${qIdx + 1}`}
                        </span>

                        {isText ? (
                          <div className="bg-slate-50 border border-slate-200/80 rounded-md p-2.5">
                            <AnswerText text={formattedAns} />
                          </div>
                        ) : (
                          <div>
                            {formattedAns ? (
                              <span
                                className="text-xs font-medium text-slate-900 bg-slate-100 border border-slate-200 rounded px-2 py-0.5 inline-block truncate max-w-full"
                                title={formattedAns}
                              >
                                {formattedAns}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-xs">—</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW: Sticky first col, tooltips on headers, min-w-[160px], scrolls inside container only */
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-none">
          <div className="overflow-x-auto max-w-full">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold select-none">
                <tr>
                  {/* Sticky first column */}
                  <th
                    scope="col"
                    className="sticky left-0 z-20 bg-slate-50 px-3 py-2.5 whitespace-nowrap w-16 text-center border-r border-slate-200"
                  >
                    #
                  </th>
                  <th scope="col" className="px-3 py-2.5 whitespace-nowrap w-24">
                    Sentiment
                  </th>
                  {visibleQuestions.map((q, idx) => (
                    <th
                      key={q.entryId || idx}
                      scope="col"
                      className="px-3 py-2.5 whitespace-nowrap min-w-[160px] max-w-[240px] truncate"
                      title={q.title}
                    >
                      {q.title || `Q${idx + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredResponses.map((resp, rIdx) => {
                  const badgeCfg = SENTIMENT_BADGES[resp.sentiment] || SENTIMENT_BADGES.neutral;
                  const originalIndex = responses.indexOf(resp) + 1;

                  return (
                    <tr key={resp.index ?? rIdx} className="hover:bg-slate-50/80 transition-colors">
                      {/* Sticky first column */}
                      <td className="sticky left-0 z-10 bg-white px-3 py-2.5 text-center font-mono text-slate-500 border-r border-slate-200 font-medium">
                        {originalIndex}
                      </td>

                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Badge variant={badgeCfg.variant} className="text-[11px] capitalize">
                          {badgeCfg.label}
                        </Badge>
                      </td>

                      {visibleQuestions.map((q, qIdx) => {
                        const ans = resp.answers ? resp.answers[q.entryId] : undefined;
                        const displayAns = Array.isArray(ans) ? ans.join(', ') : (ans ?? '—');

                        return (
                          <td
                            key={q.entryId || qIdx}
                            className="px-3 py-2.5 text-slate-700 min-w-[160px] max-w-[240px] truncate"
                            title={displayAns}
                          >
                            {displayAns}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
