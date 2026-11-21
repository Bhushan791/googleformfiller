import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { useToast } from './ui/Toast';
import { 
  ChevronDown, 
  ChevronUp, 
  Save, 
  Trash2, 
  Plus, 
  Database,
  FolderDown,
  Clock
} from 'lucide-react';

const COUNT_CHIPS = [10, 25, 50, 100];

const PRESETS = [
  { id: 'positive', label: 'Mostly positive', mix: { positive: 70, neutral: 20, negative: 10 } },
  { id: 'balanced', label: 'Balanced', mix: { positive: 34, neutral: 33, negative: 33 } },
  { id: 'negative', label: 'Mostly negative', mix: { positive: 10, neutral: 20, negative: 70 } },
];

export default function GenerationSettingsCard({
  formId,
  settings,
  onMixChange,
  onCountChange,
  onSkipRateChange,
  onAddPool,
  onRemovePool,
  onLoadTemplate,
  delay = { minMs: 2000, maxMs: 6000 },
  onDelayChange,
}) {
  const { addToast } = useToast();
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [poolsExpanded, setPoolsExpanded] = useState(false);
  const [newPoolName, setNewPoolName] = useState('');
  const [newPoolItems, setNewPoolItems] = useState('');

  const templateMenuRef = useRef(null);
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

  // Click outside / Esc to close template dropdown
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
    if (onLoadTemplate) onLoadTemplate(tpl);
    setTemplateMenuOpen(false);
    addToast(`Applied template "${tpl.name}"`, 'success');
  };

  const handleDeleteTemplate = (id, name, e) => {
    e.stopPropagation();
    const updated = templates.filter((t) => t.id !== id);
    saveTemplatesToStorage(updated);
    addToast(`Deleted template "${name}"`, 'info');
  };

  // Mix & counts
  const mix = settings?.mix || { positive: 70, neutral: 20, negative: 10 };
  const count = settings?.count || 50;
  const skipRate = settings?.optionalSkipRate ?? 0.1;
  const pools = settings?.pools || {};

  const posCount = Math.round((count * mix.positive) / 100);
  const neuCount = Math.round((count * mix.neutral) / 100);
  const negCount = Math.max(0, count - posCount - neuCount);

  // Slider change logic: strictly maintain 100% sum
  const handleSliderChange = (changedKey, val) => {
    const num = Math.max(0, Math.min(100, Math.round(Number(val))));
    const otherKeys = ['positive', 'neutral', 'negative'].filter((k) => k !== changedKey);
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

    onMixChange?.({
      [changedKey]: num,
      [k1]: Math.max(0, newK1),
      [k2]: Math.max(0, newK2),
    });
  };

  // Determine active preset
  let activePreset = 'custom';
  for (const p of PRESETS) {
    if (
      p.mix.positive === mix.positive &&
      p.mix.neutral === mix.neutral &&
      p.mix.negative === mix.negative
    ) {
      activePreset = p.id;
      break;
    }
  }

  // Delay inputs
  const minSec = Math.round((delay.minMs || 2000) / 1000);
  const maxSec = Math.round((delay.maxMs || 6000) / 1000);
  const minMins = (((delay.minMs || 2000) * count) / 60000).toFixed(1);
  const maxMins = (((delay.maxMs || 6000) * count) / 60000).toFixed(1);

  const handleMinSecChange = (val) => {
    const s = Math.max(0, Number(val) || 0);
    const newMinMs = s * 1000;
    const newMaxMs = Math.max(newMinMs, delay.maxMs || 6000);
    onDelayChange?.({ minMs: newMinMs, maxMs: newMaxMs });
  };

  const handleMaxSecChange = (val) => {
    const s = Math.max(minSec, Number(val) || minSec);
    const newMaxMs = s * 1000;
    onDelayChange?.({ minMs: delay.minMs || 2000, maxMs: newMaxMs });
  };

  const handleCreatePool = (e) => {
    e.preventDefault();
    const cleanName = newPoolName.trim();
    if (!cleanName) return;
    const items = newPoolItems
      .split(/[\n,]/)
      .map((i) => i.trim())
      .filter((i) => i.length > 0);

    if (items.length === 0) {
      addToast('Please enter at least one item for the pool.', 'error');
      return;
    }

    onAddPool?.(cleanName, items);
    setNewPoolName('');
    setNewPoolItems('');
    addToast(`Added pool "${cleanName}" (${items.length} items)`, 'success');
  };

  const poolCount = Object.keys(pools).length;

  return (
    <Card>
      {/* Header with Title + Templates Dropdown */}
      <CardHeader className="p-5 pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-900">
            Generation settings
          </CardTitle>

          {/* Templates Dropdown */}
          <div className="relative" ref={templateMenuRef}>
            <button
              type="button"
              onClick={() => setTemplateMenuOpen(!templateMenuOpen)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <FolderDown className="w-3.5 h-3.5 text-slate-500" />
              <span>Templates</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {templateMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-lg border border-slate-200 shadow-lg z-30 p-2 text-xs space-y-2">
                {/* Save form */}
                <form onSubmit={handleSaveTemplate} className="flex gap-1.5">
                  <input
                    type="text"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="New template name..."
                    className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded focus:border-blue-500 focus:outline-none"
                  />
                  <Button type="submit" variant="primary" size="sm" disabled={!newTemplateName.trim()}>
                    Save
                  </Button>
                </form>

                <div className="h-px bg-slate-100" />

                {/* Template list */}
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {templates.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic text-center py-2">
                      No saved templates
                    </p>
                  ) : (
                    templates.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => handleApplyTemplate(t)}
                        className="flex items-center justify-between p-1.5 rounded hover:bg-slate-50 cursor-pointer group"
                      >
                        <span className="font-medium text-slate-800 truncate pr-2 group-hover:text-blue-600">
                          {t.name}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteTemplate(t.id, t.name, e)}
                          className="text-slate-400 hover:text-red-500 p-0.5 rounded cursor-pointer"
                          aria-label={`Delete template ${t.name}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-5 divide-y divide-slate-100">
        {/* ROW 1: Response Count | Skip Rate for Optional Questions (2-col grid on >=768px) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-0">
          {/* Response Count */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="response-count-input" className="text-xs font-semibold text-slate-800">
                Response Count
              </label>
              <span className="text-[11px] font-mono text-slate-500">{count} responses</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="response-count-input"
                type="number"
                min={1}
                max={500}
                value={count}
                onChange={(e) => onCountChange?.(e.target.value)}
                className="w-24 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 font-mono"
              />
              <div className="flex items-center gap-1">
                {COUNT_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => onCountChange?.(chip)}
                    className={`px-2 py-1 text-xs rounded border transition-colors cursor-pointer ${
                      count === chip
                        ? 'bg-slate-900 border-slate-900 text-white font-medium'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-slate-400">Total submission batch target (1–500).</p>
          </div>

          {/* Optional Skip Rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="skip-rate-slider" className="text-xs font-semibold text-slate-800">
                Optional Field Skip Rate
              </label>
              <span className="text-[11px] font-mono text-slate-500">
                {Math.round(skipRate * 100)}%
              </span>
            </div>
            <input
              id="skip-rate-slider"
              type="range"
              min={0}
              max={50}
              step={5}
              value={Math.round(skipRate * 100)}
              onChange={(e) => onSkipRateChange?.(Number(e.target.value) / 100)}
              className="w-full cursor-pointer accent-blue-600"
            />
            <p className="text-[11px] text-slate-400">
              Questions marked optional may be realistically left blank.
            </p>
          </div>
        </div>

        {/* ROW 2: Sentiment Mix (Presets, 3 Sliders summing to 100, 8px Muted Bar with Counts) */}
        <div className="space-y-3 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-slate-800 block">
                Sentiment Mix
              </span>
              <span className="text-[11px] text-slate-400">
                Sets overall tone proportion for answers and option selections.
              </span>
            </div>

            {/* Presets Segmented Control */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md border border-slate-200/80 shrink-0">
              {PRESETS.map((p) => {
                const isSelected = activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onMixChange?.(p.mix)}
                    className={`px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
              {activePreset === 'custom' && (
                <span className="px-2 py-1 text-[11px] font-medium bg-white text-slate-900 rounded shadow-xs">
                  Custom
                </span>
              )}
            </div>
          </div>

          {/* 3 Live Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* Positive */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500/60" /> Positive
                </span>
                <span className="font-mono text-slate-500">{mix.positive}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={mix.positive}
                onChange={(e) => handleSliderChange('positive', e.target.value)}
                className="w-full cursor-pointer accent-green-600"
              />
            </div>

            {/* Neutral */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400" /> Neutral
                </span>
                <span className="font-mono text-slate-500">{mix.neutral}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={mix.neutral}
                onChange={(e) => handleSliderChange('neutral', e.target.value)}
                className="w-full cursor-pointer accent-slate-500"
              />
            </div>

            {/* Negative */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-400/70" /> Negative
                </span>
                <span className="font-mono text-slate-500">{mix.negative}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={mix.negative}
                onChange={(e) => handleSliderChange('negative', e.target.value)}
                className="w-full cursor-pointer accent-red-500"
              />
            </div>
          </div>

          {/* 8px Stacked Muted Bar with Counts */}
          <div className="space-y-1.5 pt-1">
            <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-100">
              <div
                className="bg-green-500/60 h-full transition-all"
                style={{ width: `${mix.positive}%` }}
                title={`Positive: ${mix.positive}%`}
              />
              <div
                className="bg-slate-300 h-full transition-all"
                style={{ width: `${mix.neutral}%` }}
                title={`Neutral: ${mix.neutral}%`}
              />
              <div
                className="bg-red-400/70 h-full transition-all"
                style={{ width: `${mix.negative}%` }}
                title={`Negative: ${mix.negative}%`}
              />
            </div>
            <p className="text-[11px] text-slate-500 text-right">
              {posCount} positive, {neuCount} neutral, {negCount} negative for {count} responses
            </p>
          </div>
        </div>

        {/* ROW 3: Submission Pacing / Delay */}
        <div className="space-y-2 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-xs font-semibold text-slate-800">
              Delay between submissions
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Min</span>
              <input
                type="number"
                min={1}
                max={60}
                value={minSec}
                onChange={(e) => handleMinSecChange(e.target.value)}
                className="w-16 rounded border border-slate-200 px-2 py-1 text-xs font-mono text-slate-800"
              />
              <span className="text-xs text-slate-400">to</span>
              <span className="text-xs text-slate-500">Max</span>
              <input
                type="number"
                min={minSec}
                max={120}
                value={maxSec}
                onChange={(e) => handleMaxSecChange(e.target.value)}
                className="w-16 rounded border border-slate-200 px-2 py-1 text-xs font-mono text-slate-800"
              />
              <span className="text-xs text-slate-500">seconds</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              Estimated completion time: ~{minMins} to {maxMins} minutes for {count} submissions.
            </span>
          </div>
        </div>

        {/* ROW 4: Custom Data Pools (Collapsed by default) */}
        <div className="space-y-3 pt-4">
          <button
            type="button"
            onClick={() => setPoolsExpanded(!poolsExpanded)}
            className="w-full flex items-center justify-between text-left text-xs font-semibold text-slate-800 hover:text-blue-600 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-500" />
              <span>Custom Data Pools</span>
              <Badge variant="neutral" className="text-[10px] font-normal">
                {poolCount} {poolCount === 1 ? 'pool' : 'pools'}
              </Badge>
            </div>
            {poolsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {poolsExpanded && (
            <div className="space-y-4 pt-1 animate-in fade-in duration-150">
              {/* Existing pools */}
              {poolCount > 0 ? (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-md bg-white">
                  {Object.entries(pools).map(([pName, pItems]) => (
                    <div
                      key={pName}
                      className="flex items-center justify-between px-3 py-2 text-xs"
                    >
                      <div>
                        <span className="font-medium text-slate-800">{pName}</span>
                        <span className="text-[11px] text-slate-400 ml-2">
                          ({pItems?.length || 0} items)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemovePool?.(pName)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded cursor-pointer"
                        aria-label={`Remove pool ${pName}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">
                  No pools created yet. Custom pools let you supply predefined answer pools (e.g. employee IDs, store numbers).
                </p>
              )}

              {/* Add pool form */}
              <form onSubmit={handleCreatePool} className="space-y-2 bg-slate-50 p-3 rounded-md border border-slate-200">
                <span className="text-xs font-semibold text-slate-700 block">
                  Add New Data Pool
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={newPoolName}
                    onChange={(e) => setNewPoolName(e.target.value)}
                    placeholder="Pool name (e.g. Cities)"
                    className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={newPoolItems}
                    onChange={(e) => setNewPoolItems(e.target.value)}
                    placeholder="Items (comma or newline separated)"
                    className="sm:col-span-2 w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div className="flex justify-end pt-1">
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    icon={Plus}
                    disabled={!newPoolName.trim() || !newPoolItems.trim()}
                  >
                    Add Pool
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

