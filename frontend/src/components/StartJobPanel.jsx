import React, { useState } from 'react';
import { Play, Info } from 'lucide-react';
import Button from './ui/Button';
import Alert from './ui/Alert';

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

  const avgSec = (minSec + maxSec) / 2;
  const totalEstimatedSec = Math.round(count * avgSec);
  const formatEstimatedTime = (sec) => {
    if (sec < 60) return `about ${sec} sec`;
    const mins = Math.round(sec / 60);
    return `about ${mins} min`;
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
    <div className="w-full rounded-lg border border-slate-200 bg-white p-5 space-y-4">
      {/* Header & Summary Line */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          Pre-flight Submission Setup
        </h3>
        <p className="mt-0.5 text-xs text-slate-600 font-medium">
          {count} response{count !== 1 ? 's' : ''}, {formatEstimatedTime(totalEstimatedSec)}
        </p>
      </div>

      {/* No Dry Run Warning Info Alert */}
      {!hasDryRun && (
        <Alert
          variant="info"
          title="Recommendation: Review Dry Run First"
        >
          <p className="mt-0.5 text-xs text-blue-700">
            You haven&apos;t generated sample responses yet. Inspecting sample answers in Step 3 helps verify field formatting before live submission.
          </p>
        </Alert>
      )}

      <form onSubmit={handleStart} className="space-y-4">
        {/* Delay Range Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-md bg-slate-50 border border-slate-200">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Min Delay (seconds)
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="30"
              value={minSec}
              onChange={(e) => handleMinSecChange(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            />
            <span className="mt-0.5 block text-[10px] text-slate-400">Lower bound between requests</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Max Delay (seconds)
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="60"
              value={maxSec}
              onChange={(e) => handleMaxSecChange(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            />
            <span className="mt-0.5 block text-[10px] text-slate-400">Paced upper bound</span>
          </div>
        </div>

        {/* Required Permission Checkbox */}
        <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3.5">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={ownsForm}
              onChange={(e) => setOwnsForm(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-xs font-medium text-slate-800 select-none leading-relaxed">
              I own this form or have permission to submit test responses to it.
            </span>
          </label>
        </div>

        {/* Start error message */}
        {error && (
          <Alert variant="error" title="Submission failed to start">
            <p className="mt-0.5 text-xs text-rose-700">{error}</p>
          </Alert>
        )}

        {/* Submit Primary CTA */}
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={loading}
          disabled={!isValid || loading}
          icon={Play}
          className="w-full"
        >
          {loading ? 'Initializing Job…' : `Start Submitting ${count} Responses`}
        </Button>
      </form>
    </div>
  );
}
