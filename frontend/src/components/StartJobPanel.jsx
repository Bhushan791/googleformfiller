import { useState } from 'react';

export default function StartJobPanel({
  formUrl,
  count,
  onCountChange,
  delay,
  onDelayChange,
  hasDryRun,
  onStartJob,
  loading = false,
  error = null,
}) {
  const [ownsForm, setOwnsForm] = useState(false);

  const minSec = (delay?.minMs ?? 2000) / 1000;
  const maxSec = (delay?.maxMs ?? 6000) / 1000;

  const handleMinSecChange = (val) => {
    const sec = Math.max(0.5, Math.min(60, Number(val) || 1));
    const newMinMs = Math.round(sec * 1000);
    const newMaxMs = Math.max(newMinMs, delay?.maxMs ?? 6000);
    onDelayChange({ minMs: newMinMs, maxMs: newMaxMs });
  };

  const handleMaxSecChange = (val) => {
    const sec = Math.max(0.5, Math.min(60, Number(val) || 1));
    const newMaxMs = Math.round(sec * 1000);
    const newMinMs = Math.min(newMaxMs, delay?.minMs ?? 2000);
    onDelayChange({ minMs: newMinMs, maxMs: newMaxMs });
  };

  // Estimate total time
  const avgSec = (minSec + maxSec) / 2;
  const totalEstimatedSec = Math.round(count * avgSec);
  const formatEstimatedTime = (sec) => {
    if (sec < 60) return `~${sec} seconds`;
    const mins = Math.floor(sec / 60);
    const remainingSec = sec % 60;
    return `~${mins}m ${remainingSec}s`;
  };

  const isValid =
    ownsForm &&
    count >= 1 &&
    count <= 500 &&
    delay?.minMs >= 500 &&
    delay?.maxMs >= delay?.minMs;

  const handleStart = (e) => {
    e.preventDefault();
    if (!isValid || loading) return;
    onStartJob();
  };

  return (
    <div className="w-full max-w-xl rounded-2xl border-2 border-indigo-100 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-bold text-gray-900">
          Start Live Submission Job
        </h3>
        <p className="mt-0.5 text-xs text-gray-500">
          Generates and submits realistic responses sequentially to Google Forms.
        </p>
      </div>

      <form onSubmit={handleStart} className="space-y-4">
        {/* Count & Delays Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700">
              Total Responses
            </label>
            <input
              type="number"
              min="1"
              max="500"
              value={count}
              onChange={(e) => onCountChange(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="mt-0.5 block text-[10px] text-gray-400">Max 500</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">
              Min Delay (sec)
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="30"
              value={minSec}
              onChange={(e) => handleMinSecChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="mt-0.5 block text-[10px] text-gray-400">Random delay range</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700">
              Max Delay (sec)
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="60"
              value={maxSec}
              onChange={(e) => handleMaxSecChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="mt-0.5 block text-[10px] text-gray-400">Paced submission</span>
          </div>
        </div>

        {/* Estimation Summary Box */}
        <div className="flex items-center justify-between rounded-lg bg-indigo-50/60 px-4 py-2.5 text-xs text-indigo-900">
          <div>
            <span className="font-medium">Estimated job duration:</span>{' '}
            <span className="font-bold">{formatEstimatedTime(totalEstimatedSec)}</span>
          </div>
          <span className="text-[11px] text-indigo-700">
            Avg {avgSec.toFixed(1)}s / response
          </span>
        </div>

        {/* Dry run reminder */}
        {!hasDryRun && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <span className="text-sm">💡</span>
            <div>
              <p className="font-medium">Recommendation: Run a Dry Run preview first</p>
              <p className="mt-0.5 text-amber-700">
                You have not previewed generated responses yet. We suggest clicking &quot;Dry Run Preview&quot; above to inspect sample data before submitting.
              </p>
            </div>
          </div>
        )}

        {/* Guardrail Checkbox */}
        <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3.5">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={ownsForm}
              onChange={(e) => setOwnsForm(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="text-xs font-medium text-gray-800 select-none">
              I own this form or have permission to submit test responses to it.
            </span>
          </label>
        </div>

        {/* Error message */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <p className="font-semibold">Could not start submission job:</p>
            <p className="mt-0.5">{error}</p>
          </div>
        )}

        {/* Start Button */}
        <button
          type="submit"
          disabled={!isValid || loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-indigo-700 hover:shadow-lg disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg
                className="h-4 w-4 animate-spin text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span>Initializing Job…</span>
            </>
          ) : (
            <span>🚀 Start Submitting {count} Responses</span>
          )}
        </button>
      </form>
    </div>
  );
}

