export default function SentimentControls({ mix, onChange, totalCount = 50 }) {
  const { positive, neutral, negative } = mix;

  const handleSliderChange = (changedKey, newVal) => {
    const val = Math.max(0, Math.min(100, Math.round(Number(newVal))));
    const otherKeys = ["positive", "neutral", "negative"].filter((k) => k !== changedKey);
    const [k1, k2] = otherKeys;

    const remaining = 100 - val;
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

    onChange({
      [changedKey]: val,
      [k1]: Math.max(0, newK1),
      [k2]: Math.max(0, newK2),
    });
  };

  const applyPreset = (preset) => {
    onChange(preset);
  };

  // Projected counts
  const posCount = Math.round((totalCount * positive) / 100);
  const neuCount = Math.round((totalCount * neutral) / 100);
  const negCount = Math.max(0, totalCount - posCount - neuCount);

  return (
    <div className="w-full rounded-lg border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Sentiment Mix</h4>
          <p className="text-xs text-gray-500">
            Control the overall tone and ratio of responses.
          </p>
        </div>
        {/* Presets */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => applyPreset({ positive: 70, neutral: 20, negative: 10 })}
            className={`rounded px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors border
              ${positive === 70 && neutral === 20 && negative === 10
                ? "bg-green-50 border-green-300 text-green-700"
                : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"}`}
          >
            Mostly Positive
          </button>
          <button
            type="button"
            onClick={() => applyPreset({ positive: 34, neutral: 33, negative: 33 })}
            className={`rounded px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors border
              ${positive === 34 && neutral === 33 && negative === 33
                ? "bg-blue-50 border-blue-300 text-blue-700"
                : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"}`}
          >
            Balanced
          </button>
          <button
            type="button"
            onClick={() => applyPreset({ positive: 10, neutral: 20, negative: 70 })}
            className={`rounded px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors border
              ${positive === 10 && neutral === 20 && negative === 70
                ? "bg-red-50 border-red-300 text-red-700"
                : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"}`}
          >
            Mostly Negative
          </button>
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-3">
        {/* Positive Slider */}
        <div>
          <div className="flex justify-between text-xs font-medium mb-1">
            <span className="text-green-700 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              Positive
            </span>
            <span className="text-gray-600">{positive}% ({posCount} responses)</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={positive}
            onChange={(e) => handleSliderChange("positive", e.target.value)}
            className="w-full accent-green-600 cursor-pointer"
          />
        </div>

        {/* Neutral Slider */}
        <div>
          <div className="flex justify-between text-xs font-medium mb-1">
            <span className="text-gray-600 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-gray-400" />
              Neutral
            </span>
            <span className="text-gray-600">{neutral}% ({neuCount} responses)</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={neutral}
            onChange={(e) => handleSliderChange("neutral", e.target.value)}
            className="w-full accent-gray-500 cursor-pointer"
          />
        </div>

        {/* Negative Slider */}
        <div>
          <div className="flex justify-between text-xs font-medium mb-1">
            <span className="text-red-700 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
              Negative
            </span>
            <span className="text-gray-600">{negative}% ({negCount} responses)</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={negative}
            onChange={(e) => handleSliderChange("negative", e.target.value)}
            className="w-full accent-red-600 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

