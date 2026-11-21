import { useState } from 'react';

export default function QuestionOverridePanel({
  question,
  override,
  onChange,
  pools = {},
}) {
  const [isOpen, setIsOpen] = useState(false);

  const mode = override?.mode || 'default';
  const poolNames = Object.keys(pools);

  const handleModeChange = (newMode) => {
    if (newMode === 'default') {
      onChange(null);
    } else if (newMode === 'fixed') {
      const defaultVal = question.options?.[0] || '';
      onChange({ mode: 'fixed', value: defaultVal });
    } else if (newMode === 'mix') {
      onChange({ mode: 'mix', mix: { positive: 70, neutral: 20, negative: 10 } });
    } else if (newMode === 'pool') {
      onChange({ mode: 'pool', poolName: poolNames[0] || '' });
    } else if (newMode === 'random') {
      onChange({ mode: 'random' });
    }
  };

  const handleFixedValueChange = (val) => {
    onChange({ mode: 'fixed', value: val });
  };

  const handlePoolChange = (poolName) => {
    onChange({ mode: 'pool', poolName });
  };

  const handleMixChange = (key, val) => {
    const num = Math.max(0, Math.min(100, Number(val) || 0));
    const currentMix = override?.mix || { positive: 70, neutral: 20, negative: 10 };
    const otherKeys = ['positive', 'neutral', 'negative'].filter((k) => k !== key);
    const remaining = 100 - num;
    const otherSum = currentMix[otherKeys[0]] + currentMix[otherKeys[1]];

    let k1Val;
    let k2Val;
    if (otherSum === 0) {
      k1Val = Math.floor(remaining / 2);
      k2Val = remaining - k1Val;
    } else {
      k1Val = Math.round((currentMix[otherKeys[0]] / otherSum) * remaining);
      k2Val = remaining - k1Val;
    }

    onChange({
      mode: 'mix',
      mix: {
        [key]: num,
        [otherKeys[0]]: Math.max(0, k1Val),
        [otherKeys[1]]: Math.max(0, k2Val),
      },
    });
  };

  const isCustomized = mode !== 'default';

  return (
    <div className="mt-3 pt-2 border-t border-gray-100">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs font-medium text-gray-500 hover:text-indigo-600 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <span>{isOpen ? '▾' : '▸'}</span>
          <span>Customize answer logic</span>
          {isCustomized && (
            <span className="ml-1 rounded-full bg-indigo-50 px-1.5 py-0.2 text-[10px] text-indigo-700 font-bold border border-indigo-200">
              {mode}
            </span>
          )}
        </button>
        {isCustomized && !isOpen && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[11px] text-gray-400 hover:text-red-500 cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>

      {isOpen && (
        <div className="mt-3 bg-gray-50 rounded-lg p-3 space-y-3 text-xs border border-gray-200">
          <div>
            <label className="block font-medium text-gray-700 mb-1">Answer Mode</label>
            <select
              value={mode}
              onChange={(e) => handleModeChange(e.target.value)}
              className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="default">Inherit overall response sentiment</option>
              <option value="fixed">Fixed constant answer</option>
              <option value="mix">Custom sentiment mix for this question</option>
              <option value="pool">Draw from custom pool</option>
              <option value="random">Pure uniform random</option>
            </select>
          </div>

          {/* Fixed value input */}
          {mode === 'fixed' && (
            <div>
              <label className="block font-medium text-gray-700 mb-1">Fixed Value</label>
              {question.options?.length > 0 ? (
                <select
                  value={override.value || ''}
                  onChange={(e) => handleFixedValueChange(e.target.value)}
                  className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-800"
                >
                  {question.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Enter fixed text..."
                  value={override.value || ''}
                  onChange={(e) => handleFixedValueChange(e.target.value)}
                  className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-800"
                />
              )}
            </div>
          )}

          {/* Custom Pool selection */}
          {mode === 'pool' && (
            <div>
              <label className="block font-medium text-gray-700 mb-1">Choose Pool</label>
              {poolNames.length > 0 ? (
                <select
                  value={override.poolName || poolNames[0]}
                  onChange={(e) => handlePoolChange(e.target.value)}
                  className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-800"
                >
                  {poolNames.map((p) => (
                    <option key={p} value={p}>
                      {p} ({pools[p]?.length || 0} items)
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-gray-400 italic">
                  No pools available. Add one in the Custom Answer Pools panel above.
                </p>
              )}
            </div>
          )}

          {/* Question-level Sentiment Mix */}
          {mode === 'mix' && (
            <div className="space-y-2 pt-1">
              <div className="flex justify-between items-center text-[11px] text-gray-600">
                <span>Positive: {override.mix?.positive || 0}%</span>
                <span>Neutral: {override.mix?.neutral || 0}%</span>
                <span>Negative: {override.mix?.negative || 0}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={override.mix?.positive || 70}
                onChange={(e) => handleMixChange('positive', e.target.value)}
                className="w-full accent-green-600 cursor-pointer"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

