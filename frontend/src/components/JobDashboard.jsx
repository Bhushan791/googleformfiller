import ExportButton from './ExportButton';

export default function JobDashboard({
  job,
  onPause,
  onResume,
  onCancel,
  onClear,
  actionLoading = false,
}) {
  if (!job) return null;

  const {
    id,
    status = 'queued',
    submitted = 0,
    failed = 0,
    total = 0,
    remaining = 0,
    etaSeconds = 0,
    error = null,
    errors = [],
  } = job;

  const percent = total > 0 ? Math.min(100, Math.round(((submitted + failed) / total) * 100)) : 0;
  const successPercent = total > 0 ? Math.min(100, Math.round((submitted / total) * 100)) : 0;
  const failedPercent = total > 0 ? Math.min(100, Math.round((failed / total) * 100)) : 0;

  const formatEta = (seconds) => {
    if (!seconds || seconds <= 0) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Running
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Paused
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Completed
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Failed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700">
            <span className="h-2 w-2 rounded-full bg-gray-400" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
            Queued
          </span>
        );
    }
  };

  const isTerminal = ['completed', 'failed', 'cancelled'].includes(status);

  return (
    <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-6 shadow-md space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Submission Job
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <h3 className="text-base font-bold text-gray-900 font-mono">
              #{id.slice(0, 8)}
            </h3>
            {getStatusBadge()}
          </div>
        </div>

        {/* Export / Reset Actions */}
        <div className="flex items-center gap-2">
          {submitted > 0 && <ExportButton jobId={id} />}
          {isTerminal && (
            <button
              onClick={onClear}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Start New Job
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-semibold text-gray-600">
          <span>Overall Progress: {percent}%</span>
          {status === 'running' && (
            <span className="text-indigo-600 font-medium">ETA: {formatEta(etaSeconds)}</span>
          )}
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100 flex">
          <div
            className="bg-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${successPercent}%` }}
            title={`Submitted: ${submitted}`}
          />
          <div
            className="bg-red-500 transition-all duration-500 ease-out"
            style={{ width: `${failedPercent}%` }}
            title={`Failed: ${failed}`}
          />
        </div>
      </div>

      {/* Metric Counters */}
      <div className="grid grid-cols-4 gap-3 text-center">
        <div className="rounded-xl bg-gray-50 p-3">
          <div className="text-xs font-semibold text-gray-500">Total</div>
          <div className="mt-1 text-lg font-bold text-gray-800">{total}</div>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3">
          <div className="text-xs font-semibold text-emerald-700">Submitted</div>
          <div className="mt-1 text-lg font-bold text-emerald-800">{submitted}</div>
        </div>
        <div className="rounded-xl bg-red-50 p-3">
          <div className="text-xs font-semibold text-red-700">Failed</div>
          <div className="mt-1 text-lg font-bold text-red-800">{failed}</div>
        </div>
        <div className="rounded-xl bg-blue-50 p-3">
          <div className="text-xs font-semibold text-blue-700">Remaining</div>
          <div className="mt-1 text-lg font-bold text-blue-800">{remaining}</div>
        </div>
      </div>

      {/* Fatal Error Alerts */}
      {error === 'LOGIN_REQUIRED' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-sm">
            <span>🔒</span> Google Sign-In Required
          </div>
          <p>
            This form requires a Google account or collects verified responder email addresses. Form Auto Filler adheres strictly to security guardrails and will never attempt to bypass sign-in or spoof accounts.
          </p>
        </div>
      )}

      {error === 'FORM_CLOSED' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-sm">
            <span>🚫</span> Form Is Closed
          </div>
          <p>
            Google Forms indicated that this form is no longer accepting responses. Submissions have halted.
          </p>
        </div>
      )}

      {error === 'BLOCKED' && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-xs text-red-800 space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-sm">
            <span>🛡️</span> Submissions Blocked by Google
          </div>
          <p>
            Google presented a CAPTCHA or rate-limited requests (HTTP 429). The job stopped immediately to prevent further blocks or IP restrictions.
          </p>
        </div>
      )}

      {error === 'TOO_MANY_FAILURES' && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-sm">
            <span>⚠️</span> Job Auto-Paused: Consecutive Failures
          </div>
          <p>
            5 consecutive responses failed validation or network delivery. The job was paused so you can inspect recent errors below before choosing to resume or cancel.
          </p>
        </div>
      )}

      {error && !['LOGIN_REQUIRED', 'FORM_CLOSED', 'BLOCKED', 'TOO_MANY_FAILURES'].includes(error) && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 space-y-1">
          <div className="font-bold">Job Error</div>
          <p>{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      {!isTerminal && (
        <div className="flex items-center justify-end gap-3 pt-2">
          {status === 'running' && (
            <button
              onClick={onPause}
              disabled={actionLoading}
              className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              ⏸ Pause Job
            </button>
          )}

          {status === 'paused' && (
            <button
              onClick={onResume}
              disabled={actionLoading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              ▶ Resume Job
            </button>
          )}

          <button
            onClick={onCancel}
            disabled={actionLoading}
            className="rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            ⏹ Cancel Job
          </button>
        </div>
      )}

      {/* Recent Errors Section */}
      {errors && errors.length > 0 && (
        <div className="border-t border-gray-100 pt-4">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            Recent Errors (Last {errors.length})
          </h4>
          <div className="max-h-36 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 divide-y divide-gray-200 text-xs">
            {errors.map((err, i) => (
              <div key={i} className="p-2.5 flex items-start justify-between gap-3">
                <div>
                  <span className="font-semibold text-gray-700">
                    Response #{err.index + 1}:
                  </span>{' '}
                  <span className="text-red-600">{err.error}</span>
                </div>
                {err.submittedAt && (
                  <span className="text-[10px] text-gray-400 whitespace-nowrap">
                    {new Date(err.submittedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

