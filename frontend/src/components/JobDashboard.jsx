import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  Copy, 
  ChevronDown, 
  ChevronUp, 
  Download, 
  AlertCircle, 
  CheckCircle2, 
  X,
  Clock,
  ArrowLeft,
  Activity,
  AlertTriangle
} from 'lucide-react';
import Button from './ui/Button';
import Badge from './ui/Badge';
import Alert from './ui/Alert';
import ProgressBar from './ui/ProgressBar';
import ExportButton from './ExportButton';
import { useToast } from './ui/Toast';

export default function JobDashboard({
  job,
  onPause,
  onResume,
  onCancel,
  onClear,
  onBackToConfigure,
  onRunAgain,
  actionLoading = false,
  isWaking = false,
}) {
  const { addToast } = useToast();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [errorsOpen, setErrorsOpen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const startTimeRef = useRef(Date.now());
  const cancelModalRef = useRef(null);

  // Live elapsed timer
  useEffect(() => {
    if (!job) return;
    const isFinished = ['completed', 'failed', 'cancelled'].includes(job.status);
    if (isFinished) return;

    const interval = setInterval(() => {
      const start = job.startedAt ? new Date(job.startedAt).getTime() : startTimeRef.current;
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [job?.status, job?.startedAt]);

  // Esc closes cancel modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showCancelModal) {
        setShowCancelModal(false);
      }
    };
    if (showCancelModal) {
      window.addEventListener('keydown', handleKeyDown);
      cancelModalRef.current?.focus();
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCancelModal]);

  if (!job) {
    return (
      <div className="w-full rounded-lg border border-slate-200 bg-white p-12 text-center space-y-4">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900">Connecting to submission session…</h3>
          <p className="text-xs text-slate-500">Retrieving live job progress and response logs from server.</p>
        </div>
      </div>
    );
  }

  const {
    id,
    status = 'queued',
    submitted = 0,
    failed = 0,
    total = 0,
    remaining = Math.max(0, total - submitted - failed),
    etaSeconds = 0,
    error = null,
    errors = [],
    logs = [],
  } = job;

  const percent = total > 0 ? Math.min(100, Math.round(((submitted + failed) / total) * 100)) : 0;

  const formatSeconds = (sec) => {
    if (!sec || sec <= 0) return '0s';
    if (sec < 60) return `${sec}s`;
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}m ${s}s`;
  };

  const copyJobId = () => {
    if (!id) return;
    navigator.clipboard?.writeText(id).then(() => {
      addToast('Job ID copied to clipboard', 'info');
    }).catch(() => {
      addToast(`Job ID: ${id}`, 'info');
    });
  };

  const isTerminal = ['completed', 'failed', 'cancelled'].includes(status);
  const isFinishedSuccess = status === 'completed';

  // Construct recent activity events (last 8)
  const activityEvents = (() => {
    if (Array.isArray(logs) && logs.length > 0) {
      return logs.slice(-8).reverse();
    }
    // Synthesize from progress & errors
    const list = [];
    if (errors && errors.length > 0) {
      errors.slice(-4).forEach((err) => {
        list.push({
          type: 'error',
          text: `Response #${(err.index ?? 0) + 1} failed: ${err.error || 'Validation error'}`,
          time: err.submittedAt ? new Date(err.submittedAt).toLocaleTimeString() : null,
        });
      });
    }
    for (let i = submitted; i > Math.max(0, submitted - 4); i--) {
      list.push({
        type: 'success',
        text: `Response #${i} submitted successfully`,
        time: null,
      });
    }
    return list.slice(0, 8);
  })();

  const handleConfirmCancel = () => {
    setShowCancelModal(false);
    onCancel?.();
  };

  return (
    <div className="w-full rounded-lg border border-slate-200 bg-white p-5 space-y-5">
      {/* 1. Header: Job Session Title + Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
            Submission Session
          </span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              #{id ? id.slice(0, 8) : 'unknown'}
            </span>
            {status === 'running' && (
              <Badge variant="success" dot className="animate-pulse">
                Running
              </Badge>
            )}
            {status === 'paused' && (
              <Badge variant="warning" dot>
                Paused
              </Badge>
            )}
            {status === 'completed' && (
              <Badge variant="success">
                Completed
              </Badge>
            )}
            {status === 'failed' && (
              <Badge variant="danger">
                Failed
              </Badge>
            )}
            {status === 'cancelled' && (
              <Badge variant="neutral">
                Cancelled
              </Badge>
            )}
            {status === 'queued' && (
              <Badge variant="neutral">
                Queued
              </Badge>
            )}
          </div>
        </div>

        {/* Top Right Controls if Running */}
        {!isTerminal && (
          <div className="flex items-center gap-2">
            {status === 'running' && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onPause}
                disabled={actionLoading}
                icon={Pause}
              >
                Pause
              </Button>
            )}
            {status === 'paused' && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={onResume}
                disabled={actionLoading}
                icon={Play}
              >
                Resume
              </Button>
            )}
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => setShowCancelModal(true)}
              disabled={actionLoading}
              icon={Square}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* 2. Waking-up Alert if server is reconnecting */}
      {isWaking && (
        <Alert variant="info" title="Server Reconnecting">
          <p className="mt-0.5 text-xs text-blue-700">
            Server is waking up, progress will resume shortly.
          </p>
        </Alert>
      )}

      {/* 3. Fatal State Alerts with Plain-Language Cause + Fix + Back to Configure Button */}
      {error === 'LOGIN_REQUIRED' && (
        <Alert variant="error" title="Google Sign-In Required">
          <p className="mt-0.5 text-xs text-rose-800 leading-relaxed">
            This form requires Google authentication or collects verified responder email addresses. Autofillr operates within safe boundaries and never bypasses authentication checks.
          </p>
          <p className="mt-1.5 text-xs font-semibold text-rose-900">
            Suggested Fix: In your Google Form settings, turn off &quot;Limit to 1 response&quot; and disable &quot;Collect email addresses&quot;.
          </p>
          {onBackToConfigure && (
            <div className="mt-3">
              <Button type="button" variant="secondary" size="sm" onClick={onBackToConfigure} icon={ArrowLeft}>
                Back to configure
              </Button>
            </div>
          )}
        </Alert>
      )}

      {error === 'FORM_CLOSED' && (
        <Alert variant="error" title="Form Is Closed">
          <p className="mt-0.5 text-xs text-rose-800 leading-relaxed">
            Google Forms reported that this form is no longer accepting submissions.
          </p>
          <p className="mt-1.5 text-xs font-semibold text-rose-900">
            Suggested Fix: Open the form in Google Forms and toggle &quot;Accepting responses&quot; back on.
          </p>
          {onBackToConfigure && (
            <div className="mt-3">
              <Button type="button" variant="secondary" size="sm" onClick={onBackToConfigure} icon={ArrowLeft}>
                Back to configure
              </Button>
            </div>
          )}
        </Alert>
      )}

      {error === 'BLOCKED' && (
        <Alert variant="error" title="Submissions Blocked by Google">
          <p className="mt-0.5 text-xs text-rose-800 leading-relaxed">
            Google presented a CAPTCHA or triggered a rate limit (HTTP 429). The submission job was halted immediately to safeguard your IP address.
          </p>
          <p className="mt-1.5 text-xs font-semibold text-rose-900">
            Suggested Fix: Return to Configure, increase the delay interval to 6–12 seconds, and try again.
          </p>
          {onBackToConfigure && (
            <div className="mt-3">
              <Button type="button" variant="secondary" size="sm" onClick={onBackToConfigure} icon={ArrowLeft}>
                Back to configure
              </Button>
            </div>
          )}
        </Alert>
      )}

      {error === 'TOO_MANY_FAILURES' && (
        <Alert variant="error" title="Too Many Consecutive Failures">
          <p className="mt-0.5 text-xs text-rose-800 leading-relaxed">
            Five consecutive responses were rejected by Google Forms or timed out. The job was paused to prevent further failed attempts.
          </p>
          <p className="mt-1.5 text-xs font-semibold text-rose-900">
            Suggested Fix: Review required fields and answers in Configure, then click Resume.
          </p>
          {onBackToConfigure && (
            <div className="mt-3">
              <Button type="button" variant="secondary" size="sm" onClick={onBackToConfigure} icon={ArrowLeft}>
                Back to configure
              </Button>
            </div>
          )}
        </Alert>
      )}

      {error && !['LOGIN_REQUIRED', 'FORM_CLOSED', 'BLOCKED', 'TOO_MANY_FAILURES'].includes(error) && (
        <Alert variant="error" title="Submission Error">
          <p className="mt-0.5 text-xs text-rose-800">{error}</p>
          {onBackToConfigure && (
            <div className="mt-3">
              <Button type="button" variant="secondary" size="sm" onClick={onBackToConfigure} icon={ArrowLeft}>
                Back to configure
              </Button>
            </div>
          )}
        </Alert>
      )}

      {/* 4. RUN FINISHED State: Success Alert, Summary, Export CSV, Run Again, Load Another Form */}
      {isFinishedSuccess && (
        <div className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-emerald-950">Submissions Complete</h4>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Successfully submitted <strong>{submitted}</strong> of <strong>{total}</strong> responses (failed: {failed}) in {formatSeconds(elapsedSeconds)}.
              </p>
              <p className="text-xs font-semibold text-emerald-900 pt-1">
                Check your form&apos;s Responses tab to confirm.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-200/60">
            {submitted > 0 && <ExportButton jobId={id} />}

            {onRunAgain && (
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={onRunAgain}
                icon={Play}
              >
                Run again with same settings
              </Button>
            )}

            {onClear && (
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={onClear}
                icon={RotateCcw}
              >
                Load another form
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 5. Progress Bar & ETA / Elapsed */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-slate-700">
          <span>Overall Progress: {percent}%</span>
          <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500">
            <span>Elapsed: {formatSeconds(elapsedSeconds)}</span>
            {status === 'running' && etaSeconds > 0 && (
              <span className="text-blue-600 font-semibold">ETA: {formatSeconds(etaSeconds)}</span>
            )}
          </div>
        </div>
        {/* Thicker ProgressBar */}
        <ProgressBar value={percent} className="h-2.5" />
      </div>

      {/* 6. Four Stat Tiles (Neutral style: white surface, colored numbers only, NO tinted background) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-none">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total</div>
          <div className="mt-1 text-xl font-bold font-mono text-slate-900">{total}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-none">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Submitted</div>
          <div className="mt-1 text-xl font-bold font-mono text-emerald-600">{submitted}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-none">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Failed</div>
          <div className="mt-1 text-xl font-bold font-mono text-rose-600">{failed}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-none">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Remaining</div>
          <div className="mt-1 text-xl font-bold font-mono text-blue-600">{remaining}</div>
        </div>
      </div>

      {/* 7. Live Activity List (last 8 events) */}
      {activityEvents.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span>Recent Activity</span>
          </div>

          <div className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-slate-50/50 max-h-48 overflow-y-auto">
            {activityEvents.map((evt, idx) => {
              const text = typeof evt === 'string' ? evt : (evt?.text || 'Submission update');
              const isErr = typeof evt === 'object' && evt?.type === 'error';
              return (
                <div key={idx} className="px-3 py-1.5 text-xs flex items-center justify-between text-slate-700">
                  <div className="flex items-center gap-2 truncate">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isErr ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                    <span className={`font-mono text-xs truncate ${isErr ? 'text-rose-700 font-medium' : 'text-slate-800'}`}>
                      {text}
                    </span>
                  </div>
                  {evt && typeof evt === 'object' && evt.time && (
                    <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">
                      {evt.time}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 8. Collapsible Recent Errors */}
      {errors && errors.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setErrorsOpen(!errorsOpen)}
            className="w-full flex items-center justify-between text-left text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
          >
            <span>Recent errors ({errors.length})</span>
            {errorsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {errorsOpen && (
            <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 divide-y divide-slate-200 text-xs font-mono">
              {errors.map((err, i) => (
                <div key={i} className="p-2.5 flex items-start justify-between gap-3">
                  <div>
                    <span className="font-semibold text-slate-700">
                      Response #{(err.index ?? 0) + 1}:
                    </span>{' '}
                    <span className="text-rose-600">{err.error || 'Failed to submit'}</span>
                  </div>
                  {err.submittedAt && (
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {new Date(err.submittedAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 9. Card Footer: Copyable Job ID */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-400">
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <span>Job ID: {id}</span>
          <button
            type="button"
            onClick={copyJobId}
            aria-label="Copy full job ID"
            className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer rounded"
            title="Copy Job ID"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>

        {isTerminal && !isFinishedSuccess && onClear && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            icon={RotateCcw}
          >
            Dismiss
          </Button>
        )}
      </div>

      {/* 10. Cancel Confirmation Modal */}
      {showCancelModal && (
        <div
          className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4 animate-in fade-in duration-100"
          role="dialog"
          aria-modal="true"
        >
          <div
            ref={cancelModalRef}
            tabIndex={-1}
            className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-2xl space-y-4 focus:outline-none"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-rose-700">
                <AlertCircle className="w-5 h-5 shrink-0" strokeWidth={2} />
                <h4 className="text-sm font-semibold text-slate-900">Cancel Job?</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                aria-label="Close modal"
                className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to stop this submission job? The in-flight submission will complete, and remaining responses will be cancelled.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setShowCancelModal(false)}
              >
                Keep Running
              </Button>
              <Button
                type="button"
                variant="danger"
                size="md"
                onClick={handleConfirmCancel}
              >
                Yes, Cancel Job
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
