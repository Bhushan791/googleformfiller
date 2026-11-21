import React, { useState, useMemo } from 'react';
import Badge from './ui/Badge';
import EmptyState from './ui/EmptyState';
import QuestionDrawer from './QuestionDrawer';
import { 
  Search, 
  X, 
  SlidersHorizontal, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle,
  AlignLeft,
  FileText,
  CircleDot,
  CheckSquare,
  ListFilter,
  BarChart2,
  Calendar,
  Clock,
  HelpCircle
} from 'lucide-react';

const SHORT_TYPE_CONFIG = {
  short_text: { label: 'Short text', icon: AlignLeft },
  paragraph: { label: 'Paragraph', icon: FileText },
  multiple_choice: { label: 'Choice', icon: CircleDot },
  checkboxes: { label: 'Checkboxes', icon: CheckSquare },
  dropdown: { label: 'Dropdown', icon: ListFilter },
  linear_scale: { label: 'Scale', icon: BarChart2 },
  date: { label: 'Date', icon: Calendar },
  time: { label: 'Time', icon: Clock },
};

const CATEGORIES = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'text', label: 'Text', match: (type) => ['short_text', 'paragraph'].includes(type) },
  { id: 'choice', label: 'Choice', match: (type) => ['multiple_choice', 'checkboxes', 'dropdown'].includes(type) },
  { id: 'scale', label: 'Scale', match: (type) => type === 'linear_scale' },
  { id: 'datetime', label: 'Date/Time', match: (type) => ['date', 'time'].includes(type) },
];

export default function QuestionList({
  questions = [],
  overrides = {},
  onOverrideChange,
  pools = {},
  unsupported = [],
}) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [customizedOnly, setCustomizedOnly] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [unsupportedOpen, setUnsupportedOpen] = useState(false);

  const PAGE_SIZE = 15;

  // Compute category counts
  const counts = useMemo(() => {
    const c = { all: questions.length, text: 0, choice: 0, scale: 0, datetime: 0, customized: 0 };
    questions.forEach((q) => {
      const qKey = q.id || q.entryId;
      if (overrides[qKey]) c.customized++;
      if (['short_text', 'paragraph'].includes(q.type)) c.text++;
      else if (['multiple_choice', 'checkboxes', 'dropdown'].includes(q.type)) c.choice++;
      else if (q.type === 'linear_scale') c.scale++;
      else if (['date', 'time'].includes(q.type)) c.datetime++;
    });
    return c;
  }, [questions, overrides]);

  // Filtered questions
  const filteredQuestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    const cat = CATEGORIES.find((c) => c.id === selectedCategory) || CATEGORIES[0];

    return questions.filter((q) => {
      const qKey = q.id || q.entryId;
      const titleMatch = (q.title || '').toLowerCase().includes(query);
      const catMatch = cat.match(q.type);
      const customMatch = customizedOnly ? Boolean(overrides[qKey]) : true;
      return titleMatch && catMatch && customMatch;
    });
  }, [questions, search, selectedCategory, customizedOnly, overrides]);

  // Reset pagination when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory, customizedOnly]);

  // Paginated slice
  const paginatedQuestions = useMemo(() => {
    if (showAll || filteredQuestions.length <= PAGE_SIZE) {
      return filteredQuestions;
    }
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredQuestions.slice(start, start + PAGE_SIZE);
  }, [filteredQuestions, showAll, currentPage]);

  const totalPages = Math.ceil(filteredQuestions.length / PAGE_SIZE);

  const activeKey = activeQuestion ? (activeQuestion.id || activeQuestion.entryId) : null;
  const activeOverride = activeKey ? overrides[activeKey] : null;

  const handleSaveOverride = (overrideData) => {
    if (!activeKey) return;
    onOverrideChange?.(activeKey, overrideData);
  };

  const handleResetOverride = () => {
    if (!activeKey) return;
    onOverrideChange?.(activeKey, null);
  };

  const getSourceHint = (q, override) => {
    if (override?.mode === 'pool') return 'Pool';
    if (override?.mode === 'fixed') return 'Fixed';
    if (override?.mode === 'mix') return 'Mix';
    if (override?.mode === 'random') return 'Random';
    const title = (q.title || '').toLowerCase();
    if (
      title.includes('name') ||
      title.includes('email') ||
      title.includes('phone') ||
      title.includes('age')
    ) {
      return 'Auto';
    }
    return 'AI';
  };

  return (
    <div className="w-full bg-white border border-slate-200 rounded-lg p-5 space-y-4">
      {/* Unsupported questions alert (collapsed by default) */}
      {unsupported?.length > 0 && (
        <div className="border border-amber-200 bg-amber-50/70 rounded-md p-3 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-900 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                {unsupported.length} unsupported question{unsupported.length !== 1 ? 's' : ''} will be skipped
              </span>
            </div>
            <button
              type="button"
              onClick={() => setUnsupportedOpen(!unsupportedOpen)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 hover:text-amber-950 cursor-pointer"
            >
              <span>{unsupportedOpen ? 'Hide' : 'View'}</span>
              {unsupportedOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
          {unsupportedOpen && (
            <ul className="mt-2.5 space-y-1 pt-2 border-t border-amber-200/60 text-amber-800 text-[11px]">
              {unsupported.map((item, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="font-mono text-amber-600 mt-0.5">•</span>
                  <span>
                    <strong>{item.title || 'Untitled'}</strong>
                    {item.reason && ` — ${item.reason}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Card Header: Title with count, search input, filter chips, customized only toggle */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Questions
            </h3>
            <Badge variant="neutral" className="text-xs font-mono">
              {questions.length}
            </Badge>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions..."
              className="w-full rounded-md border border-slate-200 bg-white pl-8 pr-7 py-1 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                aria-label="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Filter chips & Customized-only toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              const countForCat = counts[cat.id] ?? 0;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className={`text-[10px] font-mono ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                    ({countForCat})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Customized only toggle */}
          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={customizedOnly}
              onChange={(e) => setCustomizedOnly(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span>Customized only ({counts.customized})</span>
          </label>
        </div>
      </div>

      {/* Table-like Questions List */}
      <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
        {/* Table Header (Desktop/Tablet) */}
        <div className="hidden md:flex items-center px-4 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none">
          <div className="w-8 shrink-0 text-center font-mono">#</div>
          <div className="flex-1 min-w-0 pr-3">Title</div>
          <div className="w-28 shrink-0">Type</div>
          <div className="w-12 shrink-0 text-center">Req</div>
          <div className="w-14 shrink-0 text-right pr-2">Source</div>
          <div className="w-20 shrink-0 text-center">Status</div>
          <div className="w-8 shrink-0 text-right">Edit</div>
        </div>

        {/* Rows */}
        {paginatedQuestions.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {paginatedQuestions.map((q, idx) => {
              const qKey = q.id || q.entryId;
              const hasOverride = Boolean(overrides[qKey]);
              const questionNumber = filteredQuestions.indexOf(q) + 1;
              const typeCfg = SHORT_TYPE_CONFIG[q.type] || { label: q.type, icon: HelpCircle };
              const TypeIcon = typeCfg.icon;
              const sourceHint = getSourceHint(q, overrides[qKey]);

              return (
                <div
                  key={qKey || idx}
                  onClick={() => setActiveQuestion(q)}
                  className="group hover:bg-slate-50/80 transition-colors cursor-pointer"
                >
                  {/* Desktop / Tablet Row (48px high, fixed columns) */}
                  <div className="hidden md:flex items-center h-12 px-4 text-xs">
                    {/* # (32px) */}
                    <div className="w-8 shrink-0 text-center font-mono text-slate-400 font-medium">
                      {questionNumber}
                    </div>

                    {/* Title (flex, truncate with tooltip) */}
                    <div className="flex-1 min-w-0 pr-3">
                      <span
                        className="font-medium text-slate-900 truncate block group-hover:text-blue-600 transition-colors"
                        title={q.title}
                      >
                        {q.title || `Untitled Question ${questionNumber}`}
                      </span>
                    </div>

                    {/* Type Badge (no wrap, whitespace-nowrap, icon + short label) */}
                    <div className="w-28 shrink-0 whitespace-nowrap flex items-center">
                      <Badge variant="neutral" className="text-[11px] font-normal inline-flex items-center gap-1 px-2 py-0.5 whitespace-nowrap">
                        <TypeIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{typeCfg.label}</span>
                      </Badge>
                    </div>

                    {/* Required badge (never cut off) */}
                    <div className="w-12 shrink-0 flex justify-center items-center">
                      {q.required ? (
                        <Badge variant="danger" className="text-[10px] px-1.5 py-0 font-medium shrink-0">
                          Req
                        </Badge>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </div>

                    {/* Source hint (small muted: "AI", "Auto", "Pool", "Fixed") */}
                    <div className="w-14 shrink-0 text-right pr-2 text-[11px] text-slate-400 font-medium">
                      {sourceHint}
                    </div>

                    {/* Customized badge */}
                    <div className="w-20 shrink-0 flex justify-center items-center">
                      {hasOverride ? (
                        <Badge variant="info" className="text-[10px] px-1.5 py-0 font-medium shrink-0">
                          Customized
                        </Badge>
                      ) : null}
                    </div>

                    {/* Customize icon button */}
                    <div className="w-8 shrink-0 flex justify-end items-center">
                      <button
                        type="button"
                        aria-label={`Customize ${q.title}`}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveQuestion(q);
                        }}
                      >
                        <SlidersHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Mobile Compact Two-Line Row (<768px) */}
                  <div className="md:hidden p-3 space-y-1.5 text-xs">
                    {/* Line 1: # + Title + Req */}
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-400 font-medium text-[11px]">
                        #{questionNumber}
                      </span>
                      <span
                        className="font-medium text-slate-900 truncate flex-1 group-hover:text-blue-600"
                        title={q.title}
                      >
                        {q.title || `Untitled Question ${questionNumber}`}
                      </span>
                      {q.required && (
                        <Badge variant="danger" className="text-[10px] px-1.5 py-0 font-medium shrink-0">
                          Req
                        </Badge>
                      )}
                    </div>

                    {/* Line 2: Type badge + Source hint + Customized badge + Customize icon */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="neutral" className="text-[10px] inline-flex items-center gap-1 px-1.5 py-0 font-normal">
                          <TypeIcon className="w-3 h-3 text-slate-500" />
                          <span>{typeCfg.label}</span>
                        </Badge>
                        <span className="text-slate-400 font-medium">Source: {sourceHint}</span>
                        {hasOverride && (
                          <Badge variant="info" className="text-[10px] px-1.5 py-0">
                            Customized
                          </Badge>
                        )}
                      </div>
                      <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <EmptyState
              title="No questions match"
              description="Try adjusting your search terms or category filters."
            />
          </div>
        )}
      </div>

      {/* Pagination or Show All Controls (if >15 questions) */}
      {filteredQuestions.length > PAGE_SIZE && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 text-xs text-slate-500">
          <div>
            Showing{' '}
            <span className="font-semibold text-slate-700">
              {showAll
                ? `all ${filteredQuestions.length}`
                : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filteredQuestions.length)} of ${filteredQuestions.length}`}
            </span>{' '}
            questions
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
            >
              {showAll ? 'Show paginated' : `Show all (${filteredQuestions.length})`}
            </button>

            {!showAll && totalPages > 1 && (
              <div className="flex items-center gap-1 ml-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-2 py-1 rounded border border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Prev
                </button>
                <span className="px-2 font-mono text-xs text-slate-500">
                  {currentPage}/{totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2 py-1 rounded border border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customize Drawer Modal */}
      {activeQuestion && (
        <QuestionDrawer
          question={activeQuestion}
          override={activeOverride}
          onSave={handleSaveOverride}
          onReset={handleResetOverride}
          onClose={() => setActiveQuestion(null)}
          pools={pools}
        />
      )}
    </div>
  );
}
