import React, { useState, useEffect, useRef } from 'react';
import { 
  FolderDown, 
  Save, 
  Trash2, 
  Upload, 
  ChevronDown, 
  ChevronUp, 
  X,
  FileText,
  Sliders,
  Check
} from 'lucide-react';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { useToast } from './ui/Toast';

export default function ConfigureSettingsCard({
  formId,
  settings,
  onMixChange,
  onCountChange,
  onSkipRateChange,
  onAddPool,
  onRemovePool,
  onLoadTemplate,
  delay,
}) {
  const { addToast } = useToast();
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [poolInputOpen, setPoolInputOpen] = useState(false);
  const [poolName, setPoolName] = useState('');
  const [poolContent, setPoolContent] = useState('');
  const [poolError, setPoolError] = useState('');

  const templateMenuRef = useRef(null);
  const fileInputRef = useRef(null);

  const storageKey = `formbot_templates_${formId || 'default'}`;

  // Load templates from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setTemplates(JSON.parse(raw));
    } catch {
      setTemplates([]);
    }
  }, [storageKey]);

  // Close template menu on outside click or Esc
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (templateMenuRef.current && !templateMenuRef.current.contains(e.target)) {
        setTemplateMenuOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setTemplateMenuOpen(false);
    };
    if (templateMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [templateMenuOpen]);

  const saveTemplatesToStorage = (updated) => {
    setTemplates(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to save templates', err);
    }
  };

  const handleSaveTemplate = (e) => {
    e.preventDefault();
    const name = newTemplateName.trim();
    if (!name) return;

    const newTpl = {
      id: Date.now().toString(),
      name,
      settings,
      count: settings.count,
      delay,
      savedAt: new Date().toISOString(),
    };

    const updated = [newTpl, ...templates.filter((t) => t.name !== name)];
    saveTemplatesToStorage(updated);
    setNewTemplateName('');
    setTemplateMenuOpen(false);
    addToast(`Saved template "${name}"`, 'success');
  };

  const handleApplyTemplate = (tpl) => {
    onLoadTemplate(tpl);
    setTemplateMenuOpen(false);
    addToast(`Loaded template "${tpl.name}"`, 'success');
  };

  const handleDeleteTemplate = (id, name, e) => {
    e.stopPropagation();
    const updated = templates.filter((t) => t.id !== id);
    saveTemplatesToStorage(updated);
    addToast(`Deleted template "${name}"`, 'info');
  };

  // Mix calculations
  const mix = settings?.mix || { positive: 70, neutral: 20, negative: 10 };
  const totalCount = settings?.count || 50;
  const posCount = Math.round((totalCount * mix.positive) / 100);
  const neuCount = Math.round((totalCount * mix.neutral) / 100);
  const negCount = Math.max(0, totalCount - posCount - neuCount);

  const handleSliderChange = (key, val) => {
    const num = Math.max(0, Math.min(100, Math.round(Number(val))));
    const otherKeys = ['positive', 'neutral', 'negative'].filter((k) => k !== key);
    const [k1, k2] = otherKeys;
    const remaining = 100 - num;
    const currentOtherSum = mix[k1] + mix[k2];

    let newK1;
    let newK2;
    if (currentOtherSum === 0) {
      newK1 = Math.floor(remaining / 2);
      newK2 = remaining - newK1;
    } else {
      newK1 = Math.round((mix[k1] / currentOtherSum) * remaining);
      newK2 = remaining - newK1;
    }

    onMixChange({
      [key]: num,
      [k1]: Math.max(0, newK1),
      [k2]: Math.max(0, newK2),
    });
  };

  const poolNames = Object.keys(settings?.pools || {});

  const handleAddPoolSubmit = (e) => {
    e.preventDefault();
    setPoolError('');
    const cName = poolName.trim();
    if (!cName) {
      setPoolError('Pool name is required.');
      return;
    }
    const items = poolContent
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (items.length === 0) {
      setPoolError('Enter or upload at least one item.');
      return;
    }

    onAddPool(cName, items);
    setPoolName('');
    setPoolContent('');
    setPoolInputOpen(false);
    addToast(`Pool "${cName}" added (${items.length} items)`, 'success');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result;
      if (typeof content === 'string') {
        setPoolContent(content);
        if (!poolName) {
          const base = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
          setPoolName(base);
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full rounded-lg border border-slate-200 bg-white shadow-none divide-y divide-slate-100">
      {/* Header with Template Menu Dropdown */}
      <div className="p-4 flex items-center justify-between relative" ref={templateMenuRef}>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
            Generation Settings
          </h3>
          <p className="text-[11px] text-slate-400">
            Volume, tone distribution and field rules
          </p>
        </div>

        {/* Template Dropdown Button */}
        <div>
          <button
            type="button"
            onClick={() => setTemplateMenuOpen(!templateMenuOpen)}
            aria-expanded={templateMenuOpen}
            aria-haspopup="true"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <FolderDown className="w-3.5 h-3.5 text-slate-500" />
            <span>Templates</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {/* Template Dropdown Popover */}
          {templateMenuOpen && (
            <div className="absolute right-4 top-14 z-30 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-800">Templates</span>
                <button
                  type="button"
                  onClick={() => setTemplateMenuOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Save current config */}
              <form onSubmit={handleSaveTemplate} className="space-y-1.5">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                  Save current settings
                </span>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="Template name..."
                    className="flex-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={!newTemplateName.trim()}
                    className="px-2"
                  >
                    Save
                  </Button>
                </div>
              </form>

              {/* Saved list */}
              <div>
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                  Saved Templates ({templates.length})
                </span>
                {templates.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {templates.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => handleApplyTemplate(t)}
                        className="flex items-center justify-between p-2 rounded-md hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200 text-xs transition-colors"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-medium text-slate-800 truncate block">
                            {t.name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {t.count} resp • {new Date(t.savedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteTemplate(t.id, t.name, e)}
                          title="Delete template"
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic py-1">
                    No templates saved yet for this form.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 1: RESPONSE COUNT */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label htmlFor="response-count-input" className="text-xs font-semibold text-slate-800 block">
              Response Count
            </label>
            <span className="text-[11px] text-slate-400">
              Total submissions to prepare (1 – 500)
            </span>
          </div>
          <input
            id="response-count-input"
            type="number"
            min="1"
            max="500"
            value={totalCount}
            onChange={(e) => onCountChange(e.target.value)}
            className="w-20 rounded-md border border-slate-300 px-2.5 py-1 text-center text-xs font-medium text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
          />
        </div>

        {/* Quick Chips */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400 mr-1">Presets:</span>
          {[10, 25, 50, 100].map((qc) => (
            <button
              key={qc}
              type="button"
              onClick={() => onCountChange(qc)}
              className={`rounded px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors border ${
                totalCount === qc
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {qc}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 2: SENTIMENT MIX */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-800">
            Sentiment Mix
          </label>
          <span className="font-mono text-[11px] text-slate-400">
            {mix.positive}% / {mix.neutral}% / {mix.negative}%
          </span>
        </div>

        {/* Presets Segmented Control */}
        <div className="grid grid-cols-3 gap-1 bg-slate-100 p-0.5 rounded-md">
          {[
            { label: 'Positive', preset: { positive: 70, neutral: 20, negative: 10 } },
            { label: 'Balanced', preset: { positive: 34, neutral: 33, negative: 33 } },
            { label: 'Negative', preset: { positive: 10, neutral: 20, negative: 70 } },
          ].map((item) => {
            const isMatch =
              mix.positive === item.preset.positive &&
              mix.neutral === item.preset.neutral &&
              mix.negative === item.preset.negative;

            return (
              <button
                key={item.label}
                type="button"
                onClick={() => onMixChange(item.preset)}
                className={`py-1 text-[11px] font-medium rounded transition-all cursor-pointer ${
                  isMatch
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Live Stacked Bar with Counts */}
        <div className="space-y-1">
          <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-100">
            <div
              className="bg-emerald-500 h-full transition-all"
              style={{ width: `${mix.positive}%` }}
              title={`Positive: ${mix.positive}% (${posCount} responses)`}
            />
            <div
              className="bg-slate-400 h-full transition-all"
              style={{ width: `${mix.neutral}%` }}
              title={`Neutral: ${mix.neutral}% (${neuCount} responses)`}
            />
            <div
              className="bg-rose-500 h-full transition-all"
              style={{ width: `${mix.negative}%` }}
              title={`Negative: ${mix.negative}% (${negCount} responses)`}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span className="text-emerald-700">{posCount} pos</span>
            <span className="text-slate-600">{neuCount} neu</span>
            <span className="text-rose-700">{negCount} neg</span>
          </div>
        </div>

        {/* Three Linked Sliders */}
        <div className="space-y-2 pt-1 text-xs">
          <div>
            <div className="flex justify-between text-[11px] mb-0.5">
              <span className="text-emerald-700 font-medium">Positive</span>
              <span className="font-mono text-slate-500">{mix.positive}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={mix.positive}
              onChange={(e) => handleSliderChange('positive', e.target.value)}
              className="w-full cursor-pointer accent-emerald-600"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-0.5">
              <span className="text-slate-700 font-medium">Neutral</span>
              <span className="font-mono text-slate-500">{mix.neutral}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={mix.neutral}
              onChange={(e) => handleSliderChange('neutral', e.target.value)}
              className="w-full cursor-pointer accent-slate-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-0.5">
              <span className="text-rose-700 font-medium">Negative</span>
              <span className="font-mono text-slate-500">{mix.negative}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={mix.negative}
              onChange={(e) => handleSliderChange('negative', e.target.value)}
              className="w-full cursor-pointer accent-rose-600"
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: OPTIONAL-QUESTION SKIP RATE */}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-semibold text-slate-800 block">
              Optional Question Skip Rate
            </label>
            <span className="text-[11px] text-slate-400">
              Probability responders omit non-required fields
            </span>
          </div>
          <span className="font-mono text-xs font-semibold text-slate-800">
            {Math.round((settings?.optionalSkipRate ?? 0.1) * 100)}%
          </span>
        </div>

        <input
          type="range"
          min="0"
          max="50"
          step="5"
          value={Math.round((settings?.optionalSkipRate ?? 0.1) * 100)}
          onChange={(e) => onSkipRateChange(Number(e.target.value) / 100)}
          className="w-full cursor-pointer accent-blue-600"
        />
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>0% (Always answer)</span>
          <span>50% (Frequently skip)</span>
        </div>
      </div>

      {/* SECTION 4: CUSTOM DATA POOLS */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-semibold text-slate-800 block">
              Custom Data Pools
            </label>
            <span className="text-[11px] text-slate-400">
              Inject external datasets (names, IDs, locations)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPoolInputOpen(!poolInputOpen)}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
          >
            {poolInputOpen ? 'Cancel' : '+ Add Pool'}
          </button>
        </div>

        {/* Existing Pools List */}
        {poolNames.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {poolNames.map((pName) => {
              const count = settings.pools[pName]?.length || 0;
              return (
                <span
                  key={pName}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700"
                >
                  <span className="font-medium text-slate-900">{pName}</span>
                  <span className="text-slate-400 text-[11px]">({count})</span>
                  <button
                    type="button"
                    onClick={() => {
                      onRemovePool(pName);
                      addToast(`Removed pool "${pName}"`, 'info');
                    }}
                    title="Remove pool"
                    className="text-slate-400 hover:text-rose-600 cursor-pointer p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 italic">
            No custom pools attached. Questions can pull from custom lists.
          </p>
        )}

        {/* Inline Add Pool Drawer / Form */}
        {poolInputOpen && (
          <form onSubmit={handleAddPoolSubmit} className="space-y-2 p-3 rounded-md bg-slate-50 border border-slate-200 text-xs">
            <input
              type="text"
              placeholder="Pool identifier (e.g. employee_names)"
              value={poolName}
              onChange={(e) => setPoolName(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />

            <textarea
              rows={3}
              placeholder="Enter values, one per line..."
              value={poolContent}
              onChange={(e) => setPoolContent(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            />

            <div className="flex items-center justify-between gap-2 pt-1">
              <input
                type="file"
                ref={fileInputRef}
                accept=".txt,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                <span>Upload TXT/CSV</span>
              </button>

              <Button type="submit" variant="primary" size="sm">
                Save Pool
              </Button>
            </div>

            {poolError && <p className="text-[11px] text-rose-600 font-medium">{poolError}</p>}
          </form>
        )}
      </div>
    </div>
  );
}

