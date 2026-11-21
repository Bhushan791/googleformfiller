import React, { useState, useMemo, useEffect, useRef } from 'react';
import Badge from './ui/Badge';
import Button from './ui/Button';
import Input from './ui/Input';
import { 
  Search, 
  SlidersHorizontal, 
  X, 
  HelpCircle, 
  Check, 
  Sparkles, 
  RotateCcw,
  Sliders
} from 'lucide-react';

const TYPE_CATEGORIES = {
  All: () => true,
  Text: (type) => ['short_text', 'paragraph'].includes(type),
  Choice: (type) => ['multiple_choice', 'checkboxes', 'dropdown'].includes(type),
  Scale: (type) => type === 'linear_scale',
  'Date-Time': (type) => ['date', 'time'].includes(type),
};

const TYPE_LABELS = {
  short_text: 'Short text',
  paragraph: 'Paragraph',
  multiple_choice: 'Multiple choice',
  checkboxes: 'Checkboxes',
  dropdown: 'Dropdown',
  linear_scale: 'Scale',
  date: 'Date',
  time: 'Time',
};

export default function QuestionList({
  questions = [],
  overrides = {},
  onOverrideChange,
  pools = {},
}) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeQuestion, setActiveQuestion] = useState(null); // question being customized in drawer

  const drawerRef = useRef(null);

  // Keyboard navigation & accessibility for drawer: close on Esc
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && activeQuestion) {
        setActiveQuestion(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeQuestion]);

  // Trap focus inside drawer when open
  useEffect(() => {
    if (activeQuestion && drawerRef.current) {
      drawerRef.current.focus();
    }
  }, [activeQuestion]);

  const filteredQuestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matchesCategory = TYPE_CATEGORIES[selectedCategory] || (() => true);

    return questions.filter((q) => {
      const titleMatch = (q.title || '').toLowerCase().includes(query);
      const categoryMatch = matchesCategory(q.type);
      return titleMatch && categoryMatch;
    });
  }, [questions, search, selectedCategory]);

  const activeKey = activeQuestion ? (activeQuestion.id || activeQuestion.entryId) : null;
  const activeOverride = activeKey ? (overrides[activeKey] || null) : null;

  const handleUpdateOverride = (partial) => {
    if (!activeKey || !onOverrideChange) return;
    if (!partial || partial.mode === 'default') {
      onOverrideChange(activeKey, null);
    } else {
      onOverrideChange(activeKey, {
        ...(activeOverride || {}),
        ...partial,
      });
    }
  };

  const handleResetOverride = () => {
    if (!activeKey || !onOverrideChange) return;
    onOverrideChange(activeKey, null);
  };

  const poolNames = Object.keys(pools);

  return (
    <div className="w-full space-y-3">
      {/* Search and Category Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions..."
            className="w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1">
          {Object.keys(TYPE_CATEGORIES).map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer border ${
                  isSelected
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Questions Compact Table-like List */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-5 sm:col-span-6">Question</div>
          <div className="col-span-3 sm:col-span-2">Type</div>
          <div className="hidden sm:block sm:col-span-1 text-center">Req</div>
          <div className="col-span-3 sm:col-span-2 text-right">Customize</div>
        </div>

        {/* Rows */}
        {filteredQuestions.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredQuestions.map((q, index) => {
              const qKey = q.id || q.entryId;
              const hasOverride = Boolean(overrides[qKey]);
              const typeLabel = TYPE_LABELS[q.type] || q.type;

              return (
                <div
                  key={qKey || index}
                  className="grid grid-cols-12 gap-3 px-4 py-3 items-center hover:bg-slate-50/70 transition-colors text-xs"
                >
                  {/* Question # */}
                  <div className="col-span-1 text-center font-mono text-slate-400 font-medium">
                    {index + 1}
                  </div>

                  {/* Title */}
                  <div className="col-span-5 sm:col-span-6 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="font-medium text-slate-900 truncate block"
                        title={q.title}
                      >
                        {q.title || `Untitled Question ${index + 1}`}
                      </span>
                    </div>
                    {q.helpText && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {q.helpText}
                      </p>
                    )}
                  </div>

                  {/* Type Badge */}
                  <div className="col-span-3 sm:col-span-2 flex items-center">
                    <Badge variant="neutral" className="text-[11px] font-normal">
                      {typeLabel}
                    </Badge>
                  </div>

                  {/* Required Flag */}
                  <div className="hidden sm:flex sm:col-span-1 justify-center">
                    {q.required ? (
                      <Badge variant="danger" className="text-[10px] px-1.5 py-0">
                        Req
                      </Badge>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </div>

                  {/* Customize Action & Override status */}
                  <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-1.5">
                    {hasOverride && (
                      <Badge variant="info" className="text-[10px] hidden md:inline-flex">
                        Customized
                      </Badge>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveQuestion(q)}
                      aria-label={`Customize question ${index + 1}: ${q.title}`}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors border ${
                        hasOverride
                          ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <SlidersHorizontal className="w-3 h-3 text-slate-500" strokeWidth={1.75} />
                      <span>{hasOverride ? 'Edit' : 'Customize'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-400">
            No questions match &quot;{search}&quot;.
          </div>
        )}
      </div>

      {/* Question Customization Drawer (Slide-over) */}
      {activeQuestion && (
        <div
          className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-[2px] flex justify-end animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawer-title"
          onClick={() => setActiveQuestion(null)}
        >
          <div
            ref={drawerRef}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col focus:outline-none animate-in slide-in-from-right duration-200"
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="neutral" className="text-[10px]">
                    {TYPE_LABELS[activeQuestion.type] || activeQuestion.type}
                  </Badge>
                  {activeQuestion.required && (
                    <Badge variant="danger" className="text-[10px]">
                      Required
                    </Badge>
                  )}
                </div>
                <h3 id="drawer-title" className="text-sm font-semibold text-slate-900 leading-snug">
                  {activeQuestion.title}
                </h3>
                {activeQuestion.helpText && (
                  <p className="text-xs text-slate-500">{activeQuestion.helpText}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveQuestion(null)}
                aria-label="Close customization drawer"
                className="rounded-md p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              {/* Option chips preview (for choice questions) */}
              {activeQuestion.options?.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Defined Options ({activeQuestion.options.length})
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 border border-slate-100 rounded-md bg-slate-50/50">
                    {activeQuestion.options.map((opt, i) => (
                      <span
                        key={i}
                        className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700 truncate max-w-[200px]"
                        title={opt}
                      >
                        {opt}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Linear Scale details */}
              {activeQuestion.scaleRange && (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                  <span className="text-[11px] font-medium text-slate-500 block mb-1">
                    Linear Scale Range: {activeQuestion.scaleRange.min} to {activeQuestion.scaleRange.max}
                  </span>
                  {(activeQuestion.scaleRange.minLabel || activeQuestion.scaleRange.maxLabel) && (
                    <p className="text-[11px] text-slate-600">
                      {activeQuestion.scaleRange.minLabel && `"${activeQuestion.scaleRange.minLabel}"`}
                      {' → '}
                      {activeQuestion.scaleRange.maxLabel && `"${activeQuestion.scaleRange.maxLabel}"`}
                    </p>
                  )}
                </div>
              )}

              {/* Answer Mode Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Answer Generation Mode
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    { id: 'default', label: 'Default', desc: 'Inherit overall response mix' },
                    { id: 'random', label: 'Random', desc: 'Pure uniform random choice' },
                    { id: 'fixed', label: 'Fixed Answer', desc: 'Always use a specific constant answer' },
                    { id: 'mix', label: 'Own Sentiment Mix', desc: 'Custom tone balance for this question' },
                    { id: 'pool', label: 'Custom Pool', desc: 'Pick randomly from an uploaded dataset' },
                  ].map((m) => {
                    const currentMode = activeOverride?.mode || 'default';
                    const isSelected = currentMode === m.id;

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          if (m.id === 'default') {
                            handleUpdateOverride({ mode: 'default' });
                          } else if (m.id === 'fixed') {
                            const defaultFixed = activeQuestion.options?.[0] || '';
                            handleUpdateOverride({ mode: 'fixed', value: defaultFixed });
                          } else if (m.id === 'mix') {
                            handleUpdateOverride({
                              mode: 'mix',
                              mix: activeOverride?.mix || { positive: 70, neutral: 20, negative: 10 },
                            });
                          } else if (m.id === 'pool') {
                            handleUpdateOverride({
                              mode: 'pool',
                              poolName: activeOverride?.poolName || poolNames[0] || '',
                            });
                          } else if (m.id === 'random') {
                            handleUpdateOverride({ mode: 'random' });
                          }
                        }}
                        className={`flex items-start justify-between p-2.5 rounded-md border text-left cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50/60 border-blue-300 ring-1 ring-blue-500'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <span className={`block font-medium ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                            {m.label}
                          </span>
                          <span className="text-[11px] text-slate-500">{m.desc}</span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fixed Answer Options */}
              {activeOverride?.mode === 'fixed' && (
                <div className="space-y-1.5 p-3 rounded-md bg-slate-50 border border-slate-200">
                  <label className="block font-medium text-slate-700">Fixed Value</label>
                  {activeQuestion.options?.length > 0 ? (
                    <select
                      value={activeOverride.value || ''}
                      onChange={(e) => handleUpdateOverride({ mode: 'fixed', value: e.target.value })}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                    >
                      {activeQuestion.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Specify fixed text..."
                      value={activeOverride.value || ''}
                      onChange={(e) => handleUpdateOverride({ mode: 'fixed', value: e.target.value })}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  )}
                </div>
              )}

              {/* Custom Pool Options */}
              {activeOverride?.mode === 'pool' && (
                <div className="space-y-1.5 p-3 rounded-md bg-slate-50 border border-slate-200">
                  <label className="block font-medium text-slate-700">Source Pool</label>
                  {poolNames.length > 0 ? (
                    <select
                      value={activeOverride.poolName || poolNames[0]}
                      onChange={(e) => handleUpdateOverride({ mode: 'pool', poolName: e.target.value })}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                    >
                      {poolNames.map((p) => (
                        <option key={p} value={p}>
                          {p} ({pools[p]?.length || 0} items)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-slate-500 italic">
                      No custom pools created yet. Add one in the Settings panel on the right.
                    </p>
                  )}
                </div>
              )}

              {/* Custom Mix Sliders */}
              {activeOverride?.mode === 'mix' && (
                <div className="space-y-3 p-3 rounded-md bg-slate-50 border border-slate-200">
                  <label className="block font-medium text-slate-700">Custom Mix Balance</label>
                  {['positive', 'neutral', 'negative'].map((key) => {
                    const mix = activeOverride.mix || { positive: 70, neutral: 20, negative: 10 };
                    return (
                      <div key={key}>
                        <div className="flex justify-between text-[11px] mb-1 capitalize">
                          <span className="font-medium text-slate-700">{key}</span>
                          <span className="font-mono text-slate-500">{mix[key]}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={mix[key]}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(100, Number(e.target.value)));
                            const others = ['positive', 'neutral', 'negative'].filter((k) => k !== key);
                            const remaining = 100 - val;
                            const currentOtherSum = mix[others[0]] + mix[others[1]];
                            let n1 = currentOtherSum === 0 ? Math.floor(remaining / 2) : Math.round((mix[others[0]] / currentOtherSum) * remaining);
                            let n2 = remaining - n1;
                            handleUpdateOverride({
                              mode: 'mix',
                              mix: {
                                [key]: val,
                                [others[0]]: Math.max(0, n1),
                                [others[1]]: Math.max(0, n2),
                              },
                            });
                          }}
                          className="w-full cursor-pointer accent-blue-600"
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Style Hint Field (max 100 chars) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-800">
                    Style Hint <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">
                    {(activeOverride?.styleHint || '').length}/100
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={100}
                  placeholder="e.g. Concise and direct, focus on battery life"
                  value={activeOverride?.styleHint || ''}
                  onChange={(e) => handleUpdateOverride({ styleHint: e.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Instructs the generation engine on specific phrasing or thematic focus.
                </p>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetOverride}
                disabled={!activeOverride}
                icon={RotateCcw}
              >
                Reset to Default
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setActiveQuestion(null)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
