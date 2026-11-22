import React, { useState } from 'react';
import { Play, Info, Sparkles, CheckSquare, Clock, ArrowRight } from 'lucide-react';
import Button from './ui/Button';
import Alert from './ui/Alert';

export default function StartJobPanel({
  formUrl,
  formTitle = '',
  count = 10,
  onCountChange,
  settings = {},
  delay = { minMs: 2000, maxMs: 6000 },
  hasDryRun = false,
  onStartJob,
  onNavigateToStep,
  loading = false,
  error = null,
}) {
  const [permissionChecked, setPermissionChecked] = useState(false);

  const mix = settings?.mix || { positive: 70, neutral: 20, negative: 10 };
  const posVal = mix?.positive ?? 70;
  const neuVal = mix?.neutral ?? 20;
  const negVal = mix?.negative ?? 10;
  const safeCount = Number(count) || 10;

  const minSec = Math.round((delay?.minMs || 2000) / 1000);
  const maxSec = Math.round((delay?.maxMs || 6000) / 1000);

  const minMins = (((delay?.minMs || 2000) * safeCount) / 60000).toFixed(1);
  const maxMins = (((delay?.maxMs || 6000) * safeCount) / 60000).toFixed(1);

  const handleStart = (e) => {
    e.preventDefault();
    if (!permissionChecked || loading) return;
    onStartJob();
  };

  return (
    <div className="w-full space-y-5">
      {/* 1. Ready to Run Card */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Ready to run
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Review the final execution parameters below before launching the submission job.
          </p>
        </div>

        {/* Summary List */}
        <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-md bg-slate-50/50">
          {/* Form */}
          <div className="p-3 flex items-center justify-between text-xs">
            <div className="min-w-0 pr-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
                Target Form
              </span>
              <p className="font-semibold text-slate-900 truncate" title={formTitle || formUrl}>
                {formTitle || 'Loaded Google Form'}
              </p>
              {formUrl && (
                <p className="text-[11px] text-slate-400 font-mono truncate max-w-sm mt-0.5">
                  {formUrl}
                </p>
              )}
            </div>
            {onNavigateToStep && (
              <button
                type="button"
                onClick={() => onNavigateToStep(1)}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 cursor-pointer shrink-0"
              >
                Edit
              </button>
            )}
          </div>

          {/* Responses */}
          <div className="p-3 flex items-center justify-between text-xs">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
                Total Planned Responses
              </span>
              <span className="font-semibold text-slate-900 font-mono text-sm">
                {count} responses
              </span>
            </div>
            {onNavigateToStep && (
              <button
                type="button"
                onClick={() => onNavigateToStep(2)}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 cursor-pointer shrink-0"
              >
                Edit
              </button>
            )}
          </div>

          {/* Sentiment Mix Bar */}
          <div className="p-3 flex items-center justify-between text-xs">
            <div className="space-y-1.5 flex-1 pr-4 max-w-md">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Tone Mix Distribution
              </span>
              <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-200">
                <div
                  className="bg-green-500/60 h-full"
                  style={{ width: `${posVal}%` }}
                  title={`Positive: ${posVal}%`}
                />
                <div
                  className="bg-slate-300 h-full"
                  style={{ width: `${neuVal}%` }}
                  title={`Neutral: ${neuVal}%`}
                />
                <div
                  className="bg-red-400/70 h-full"
                  style={{ width: `${negVal}%` }}
                  title={`Negative: ${negVal}%`}
                />
              </div>
              <span className="text-[11px] text-slate-600 font-medium block">
                Positive {posVal}% / Neutral {neuVal}% / Negative {negVal}%
              </span>
            </div>
            {onNavigateToStep && (
              <button
                type="button"
                onClick={() => onNavigateToStep(2)}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 cursor-pointer shrink-0"
              >
                Edit
              </button>
            )}
          </div>

          {/* Delay Range & Estimated Time */}
          <div className="p-3 flex items-center justify-between text-xs">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
                Delay Pacing & Estimated Time
              </span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-800">
                  {minSec}s to {maxSec}s between requests
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-600 font-medium">
                  ~{minMins} to {maxMins} minutes
                </span>
              </div>
            </div>
            {onNavigateToStep && (
              <button
                type="button"
                onClick={() => onNavigateToStep(2)}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 cursor-pointer shrink-0"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        {/* 2. Recommend-first-test hint */}
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <strong>Tip:</strong> run 1 response first and check your form&apos;s Responses tab.
            </span>
          </div>

          {count !== 1 && onCountChange && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onCountChange(1)}
              className="shrink-0"
            >
              Set count to 1
            </Button>
          )}
        </div>

        {/* 3. Info Alert if no dry run was done */}
        {!hasDryRun && (
          <Alert variant="info" title="No dry run performed">
            <p className="mt-0.5 text-xs text-blue-700 leading-relaxed">
              You haven&apos;t generated sample preview responses yet. Inspecting answers in Step 3 helps confirm formatting and variety before live submission.
            </p>
          </Alert>
        )}

        {/* 4. Required Permission Checkbox */}
        <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3.5">
          <label htmlFor="permission-checkbox" className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              id="permission-checkbox"
              type="checkbox"
              checked={permissionChecked}
              onChange={(e) => setPermissionChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
            />
            <span className="text-xs font-medium text-slate-800 leading-normal">
              I own this form or have permission to submit test responses to it.
            </span>
          </label>
        </div>

        {/* Start error message if any */}
        {error && (
          <Alert variant="error" title="Submission failed to start">
            <p className="mt-0.5 text-xs text-rose-700">{error}</p>
          </Alert>
        )}

        {/* 5. Primary Start Run CTA */}
        <Button
          type="button"
          variant="primary"
          size="md"
          loading={loading}
          disabled={!permissionChecked || loading}
          onClick={handleStart}
          icon={Play}
          className="w-full"
        >
          {loading ? 'Initializing submissions…' : `Start run (${count} responses)`}
        </Button>
      </div>
    </div>
  );
}
