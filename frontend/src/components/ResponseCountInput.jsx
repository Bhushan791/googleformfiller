export default function ResponseCountInput({ count, onChange }) {
  const quickCounts = [10, 50, 100, 250, 500];

  const handleInputChange = (e) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val)) {
      onChange(1);
    } else {
      onChange(Math.max(1, Math.min(500, val)));
    }
  };

  return (
    <div className="w-full rounded-lg border border-gray-200 bg-white p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Total Responses</h4>
          <p className="text-xs text-gray-500">
            Number of responses to prepare (1 – 500).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            max="500"
            value={count}
            onChange={handleInputChange}
            className="w-24 rounded-md border border-slate-300 px-3 py-1.5 text-center text-sm font-medium text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-400 mr-1">Quick presets:</span>
        {quickCounts.map((qc) => (
          <button
            key={qc}
            type="button"
            onClick={() => onChange(qc)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors border
              ${count === qc
                ? "bg-blue-50 border-blue-300 text-blue-700"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"}`}
          >
            {qc}
          </button>
        ))}
      </div>
    </div>
  );
}

