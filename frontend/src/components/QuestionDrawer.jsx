import React, { useState, useEffect, useRef } from 'react';
import Badge from './ui/Badge';
import Button from './ui/Button';
import { 
  X, 
  RotateCcw, 
  Check, 
  Sparkles, 
  Pin, 
  Sliders, 
  Database 
} from 'lucide-react';

const SHORT_TYPE_LABELS = {
  short_text: 'Short text',
  paragraph: 'Paragraph',
  multiple_choice: 'Choice',
  checkboxes: 'Checkboxes',
  dropdown: 'Dropdown',
  linear_scale: 'Scale',
  date: 'Date',
  time: 'Time',
};

const MODE_OPTIONS = [
  { id: 'default', label: 'Auto (default)', desc: 'Inherit overall response mix & AI generation', icon: Sparkles },
  { id: 'fixed', label: 'Fixed answer', desc: 'Always answer with a specific choice or text', icon: Pin },
  { id: 'mix', label: 'Own sentiment mix', desc: 'Custom tone balance for this question', icon: Sliders },
  { id: 'pool', label: 'Custom pool', desc: 'Draw randomly from an uploaded dataset', icon: Database },
];

export default function QuestionDrawer({
  question,
  override = null,
  onSave,
  onReset,
  onClose,
  pools = {},
}) {
  const drawerRef = useRef(null);

  // Local state for editing inside drawer
  const [mode, setMode] = useState(override?.mode || 'default');
  const [fixedValue, setFixedValue] = useState(
    override?.value ?? (question?.options?.[0] || '')
  );
  const [customMix, setCustomMix] = useState(
    override?.mix || { positive: 70, neutral: 20, negative: 10 }
  );
  const poolNames = Object.keys(pools);
  const [selectedPool, setSelectedPool] = useState(
    override?.poolName || poolNames[0] || ''
  );
  const [styleHint, setStyleHint] = useState(override?.styleHint || '');

  // Reset local state if question or override changes
  useEffect(() => {
    setMode(override?.mode || 'default');
    setFixedValue(override?.value ?? (question?.options?.[0] || ''));
    setCustomMix(override?.mix || { positive: 70, neutral: 20, negative: 10 });
    setSelectedPool(override?.poolName || poolNames[0] || '');
    setStyleHint(override?.styleHint || '');
  }, [question, override]);

  // Trap focus & close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    if (drawerRef.current) {
      drawerRef.current.focus();
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!question) return null;

  const isTextQuestion = ['short_text', 'paragraph'].includes(question.type);
  const isChoiceQuestion = ['multiple_choice', 'dropdown', 'checkboxes'].includes(question.type);
  const isScaleQuestion = question.type === 'linear_scale';

  // Custom mix slider change (guarantees 100% sum)
  const handleMixSliderChange = (key, val) => {
    const num = Math.max(0, Math.min(100, Math.round(Number(val))));
    const otherKeys = ['positive', 'neutral', 'negative'].filter((k) => k !== key);
    const [k1, k2] = otherKeys;
    const remaining = 100 - num;
    const currentOtherSum = customMix[k1] + customMix[k2];

    let newK1;
    let newK2;

    if (currentOtherSum === 0) {
      newK1 = Math.floor(remaining / 2);
      newK2 = remaining - newK1;
    } else {
      newK1 = Math.round((customMix[k1] / currentOtherSum) * remaining);
      newK2 = remaining - newK1;
    }

    setCustomMix({
      [key]: num,
      [k1]: Math.max(0, newK1),
      [k2]: Math.max(0, newK2),
    });
  };

  const handleSave = () => {
    if (mode === 'default') {
      onSave(null);
    } else if (mode === 'fixed') {
      onSave({
        mode: 'fixed',
        value: fixedValue,
        styleHint: isTextQuestion ? styleHint : undefined,
      });
    } else if (mode === 'mix') {
      onSave({
        mode: 'mix',
        mix: customMix,
        styleHint: isTextQuestion ? styleHint : undefined,
      });
    } else if (mode === 'pool') {
      onSave({
        mode: 'pool',
        poolName: selectedPool,
        styleHint: isTextQuestion ? styleHint : undefined,
      });
    }
    onClose();
  };

  const handleResetToAuto = () => {
    onReset();
    onClose();
  };

  const typeLabel = SHORT_TYPE_LABELS[question.type] || question.type;

  // Linear scale options array
  const scaleOptions = [];
  if (isScaleQuestion && question.scaleRange) {
    for (let i = question.scaleRange.min; i <= question.scaleRange.max; i++) {
      scaleOptions.push(String(i));
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-[2px] flex justify-end animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      onClick={onClose}
    >
      <div
        ref={drawerRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:w-[420px] bg-white h-full shadow-2xl flex flex-col focus:outline-none animate-in slide-in-from-right duration-200"
      >
        {/* Header: Title, Type + Req badges, Close button */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Badge variant="neutral" className="text-[11px] font-normal">
                {typeLabel}
              </Badge>
              {question.required ? (
                <Badge variant="danger" className="text-[10px] px-1.5 py-0 font-medium">
                  Req
                </Badge>
              ) : null}
            </div>
            <h3
              id="drawer-title"
              className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2"
              title={question.title}
            >
              {question.title || 'Untitled Question'}
            </h3>
            {question.helpText && (
              <p className="text-[11px] text-slate-400 line-clamp-2">
                {question.helpText}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* Answer Mode (Radio cards) */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-800">
              Answer Mode
            </label>
            <div className="space-y-1.5">
              {MODE_OPTIONS.map((opt) => {
                const isSelected = mode === opt.id;
                const IconComponent = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMode(opt.id)}
                    className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-300 ring-1 ring-blue-500'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <IconComponent className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`block font-semibold ${isSelected ? 'text-blue-950' : 'text-slate-800'}`}>
                        {opt.label}
                      </span>
                      <span className="text-[11px] text-slate-500 leading-tight block">
                        {opt.desc}
                      </span>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mode: FIXED ANSWER inputs */}
          {mode === 'fixed' && (
            <div className="space-y-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-xs font-semibold text-slate-800 block">
                Specify Fixed Answer
              </span>

              {/* Choice questions: Selectable chips */}
              {isChoiceQuestion && question.options?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-500">
                    Click an option chip to choose the fixed response:
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1 bg-white border border-slate-200 rounded-md">
                    {question.options.map((option, idx) => {
                      const isOptionSelected = fixedValue === option;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setFixedValue(option)}
                          className={`px-2.5 py-1 text-xs rounded-md border text-left transition-colors cursor-pointer truncate max-w-[280px] ${
                            isOptionSelected
                              ? 'bg-blue-600 border-blue-600 text-white font-medium'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                          title={option}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Scale questions: Selectable chips or slider */}
              {isScaleQuestion && scaleOptions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-500">
                    Choose fixed scale value ({question.scaleRange.min} to {question.scaleRange.max}):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {scaleOptions.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setFixedValue(opt)}
                        className={`w-9 h-9 text-xs rounded-md border font-mono transition-colors cursor-pointer flex items-center justify-center ${
                          fixedValue === opt
                            ? 'bg-blue-600 border-blue-600 text-white font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Text questions: Textarea */}
              {isTextQuestion && (
                <div className="space-y-1.5">
                  <label htmlFor="fixed-text-area" className="text-[11px] text-slate-500 block">
                    Fixed response text:
                  </label>
                  <textarea
                    id="fixed-text-area"
                    rows={3}
                    value={fixedValue}
                    onChange={(e) => setFixedValue(e.target.value)}
                    placeholder="Enter fixed text that will be submitted every time..."
                    className="w-full rounded-md border border-slate-200 bg-white p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              )}

              {/* Other types: simple input fallback */}
              {!isChoiceQuestion && !isScaleQuestion && !isTextQuestion && (
                <input
                  type="text"
                  value={fixedValue}
                  onChange={(e) => setFixedValue(e.target.value)}
                  placeholder="Fixed value..."
                  className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                />
              )}
            </div>
          )}

          {/* Mode: CUSTOM MIX inputs */}
          {mode === 'mix' && (
            <div className="space-y-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-xs font-semibold text-slate-800 block">
                Custom Sentiment Balance
              </span>

              {/* 3 sliders */}
              <div className="space-y-2.5">
                {/* Positive */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-500/60" /> Positive
                    </span>
                    <span className="font-mono text-slate-500">{customMix.positive}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={customMix.positive}
                    onChange={(e) => handleMixSliderChange('positive', e.target.value)}
                    className="w-full cursor-pointer accent-green-600"
                  />
                </div>

                {/* Neutral */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-400" /> Neutral
                    </span>
                    <span className="font-mono text-slate-500">{customMix.neutral}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={customMix.neutral}
                    onChange={(e) => handleMixSliderChange('neutral', e.target.value)}
                    className="w-full cursor-pointer accent-slate-500"
                  />
                </div>

                {/* Negative */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-400/70" /> Negative
                    </span>
                    <span className="font-mono text-slate-500">{customMix.negative}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={customMix.negative}
                    onChange={(e) => handleMixSliderChange('negative', e.target.value)}
                    className="w-full cursor-pointer accent-red-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Mode: CUSTOM POOL selection */}
          {mode === 'pool' && (
            <div className="space-y-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <label htmlFor="pool-select" className="text-xs font-semibold text-slate-800 block">
                Select Custom Data Pool
              </label>
              {poolNames.length > 0 ? (
                <select
                  id="pool-select"
                  value={selectedPool}
                  onChange={(e) => setSelectedPool(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                >
                  {poolNames.map((p) => (
                    <option key={p} value={p}>
                      {p} ({pools[p]?.length || 0} items)
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-[11px] text-slate-500 italic">
                  No custom pools configured. Add one in Generation Settings under Custom Data Pools.
                </p>
              )}
            </div>
          )}

          {/* Style Hint Input (for text questions, max 100 chars) */}
          {isTextQuestion && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label htmlFor="style-hint-input" className="text-xs font-semibold text-slate-800">
                  Style Hint <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <span className="text-[10px] font-mono text-slate-400">
                  {styleHint.length}/100
                </span>
              </div>
              <input
                id="style-hint-input"
                type="text"
                maxLength={100}
                value={styleHint}
                onChange={(e) => setStyleHint(e.target.value)}
                placeholder="e.g. Concise and direct, mention pricing concerns"
                className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              <p className="text-[11px] text-slate-400">
                Instructs the AI on tone, specifics, or phrasing for this text field.
              </p>
            </div>
          )}
        </div>

        {/* Footer: Reset to auto and Save */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={handleResetToAuto}
            icon={RotateCcw}
          >
            Reset to auto
          </Button>

          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleSave}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

