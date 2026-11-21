import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  Lock, 
  Ban, 
  ShieldAlert, 
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Copy,
  ChevronDown,
  ChevronUp,
  Download,
  X
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
  actionLoading = false,
}) {
  const { addToast } = useToast();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [errorsOpen, setErrorsOpen] = useState(false);

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

  const formatEta = (seconds) => {
    if (!seconds || seconds <= 0) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const copyJobId = () => {
    if (!id) return;
    navigator.clipboard?.writeText(id).then(() => {
      addToast('Job ID copied to clipboard', 'info');
    }).catch(() => {
      addToast(`Job ID: ${id}`, 'info');
    });
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'running':
        return (
          <Badge variant="success" dot className="animate-pulse">
            Running
          </Badge>
        );
      case 'paused':
        return (
          <Badge variant="warning" dot>
            Paused
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="success">
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="danger">
            Failed
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="neutral">
            Cancelled
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral">
            Queued
          </Badge>
        );
    }
  };

  const isTerminal = ['completed', 'failed', 'cancelled'].includes(status);
  const isFinishedSuccess = status === 'completed';

  const handleConfirmCancel = () => {
    setShowCancelModal(false);
    onCancel();
  };

  return (
    <div className="w-full rounded-lg border border-slate-200 bg-white p-5 space-y-5">
      {/* Header: Job ID + Status + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
            Active Job Session
          </span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              #{id.slice(0, 8)}
            </span>
            <button
              type="button"
              onClick={copyJobId}
              aria-label="Copy full job ID"
              className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
              title="Copy Job ID"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            {getStatusBadge()}
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {submitted > 0 && <ExportButton jobId={id} />}
          {isTerminal && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClear}
              icon={RotateCcw}
            >
              Start New Job
            </Button>
          )}
        </div>
      </div>

      {/* Success Completion Alert */}
      {isFinishedSuccess && (
        <Alert variant="success" title="Submissions Complete">
          <p className="mt-0.5 text-xs text-emerald-800">
            All {submitted} response{submitted !== 1 ? 's were' : ' was'} successfully submitted to Google Forms. You can download the response records as a CSV below.
          </p>
        </Alert>
      )}

      {/* Progress Bar & ETA */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-medium text-slate-600">
          <span>Overall Progress: {percent}%</span>
          {status === 'running' && (
            <span className="text-blue-600 font-mono">ETA: {formatEta(etaSeconds)}</span>
          )}
        </div>
        <ProgressBar value={percent} variant="primary" />
      </div>

      {/* Row of 4 Stat Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
        <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total</div>
          <div className="mt-0.5 text-lg font-bold text-slate-900 font-mono">{total}</div>
        </div>
        <div className="rounded-md border border-emerald-100 bg-emerald-50/50 p-3">
          <div className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider">Submitted</div>
          <div className="mt-0.5 text-lg font-bold text-emerald-800 font-mono">{submitted}</div>
        </div>
        <div className="rounded-md border border-rose-100 bg-rose-50/50 p-3">
          <div className="text-[11px] font-medium text-rose-700 uppercase tracking-wider">Failed</div>
          <div className="mt-0.5 text-lg font-bold text-rose-800 font-mono">{failed}</div>
        </div>
        <div className="rounded-md border border-blue-100 bg-blue-50/50 p-3">
          <div className="text-[11px] font-medium text-blue-700 uppercase tracking-wider">Remaining</div>
          <div className="mt-0.5 text-lg font-bold text-blue-800 font-mono">{remaining}</div>
        </div>
      </div>

      {/* Fatal Error Alerts with Plain-Language Text and Suggested Fix */}
      {error === 'LOGIN_REQUIRED' && (
        <Alert variant="error" title="Google Sign-In Required">
          <p className="mt-0.5 text-xs text-rose-800 leading-relaxed">
            This form requires a Google account or collects verified responder email addresses. Form Auto Filler adheres strictly to safety boundaries and never attempts to bypass sign-in.
          </p>
          <p className="mt-1.5 text-xs font-semibold text-rose-900">
            Suggested Fix: In Google Form Settings, disable &quot;Limit to 1 response&quot; and turn off &quot;Collect email addresses&quot;.
          </p>
        </Alert>
      )}

      {error === 'FORM_CLOSED' && (
        <Alert variant="error" title="Form Is Closed">
          <p className="mt-0.5 text-xs text-rose-800 leading-relaxed">
            Google Forms indicated that this form is no longer accepting responses. Submissions have stopped.
          </p>
          <p className="mt-1.5 text-xs font-semibold text-rose-900">
            Suggested Fix: Open the form in Google Forms and toggle &quot;Accepting responses&quot; back on.
          </p>
        </Alert>
      )}

      {error === 'BLOCKED' && (
        <Alert variant="error" title="Submissions Blocked by Google">
          <p className="mt-0.5 text-xs text-rose-800 leading-relaxed">
            Google presented a CAPTCHA or rate-limited requests (HTTP 429). The job stopped immediately to prevent further IP restrictions.
          </p>
          <p className="mt-1.5 text-xs font-semibold text-rose-900">
            Suggested Fix: Increase the delay interval between submissions (e.g. 5-10 seconds) and try again later.
          </p>
        </Alert>
      )}

      {error === 'TOO_MANY_FAILURES' && (
        <Alert variant="error" title="Job Auto-Paused: Consecutive Failures">
          <p className="mt-0.5 text-xs text-rose-800 leading-relaxed">
            5 consecutive responses failed validation or network delivery. The job was paused so you can inspect recent errors below.
          </p>
          <p className="mt-1.5 text-xs font-semibold text-rose-900">
            Suggested Fix: Verify required questions and field formats, then click Resume Job.
          </p>
        </Alert>
      )}

      {error && !['LOGIN_REQUIRED', 'FORM_CLOSED', 'BLOCKED', 'TOO_MANY_FAILURES'].includes(error) && (
        <Alert variant="error" title="Job Error">
          <p className="mt-0.5 text-xs text-rose-800">{error}</p>
        </Alert>
      )}

      {/* Utilitarian Controls: Pause / Resume / Cancel */}
      {!isTerminal && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          {status === 'running' && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onPause}
              disabled={actionLoading}
              icon={Pause}
            >
              Pause Job
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
              Resume Job
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
            Cancel Job
          </Button>
        </div>
      )}

      {/* Collapsible Recent Errors List */}
      {errors && errors.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setErrorsOpen(!errorsOpen)}
            className="w-full flex items-center justify-between text-left text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
          >
            <span>Recent Errors ({errors.length})</span>
            {errorsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {errorsOpen && (
            <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 divide-y divide-slate-200 text-xs font-mono">
              {errors.map((err, i) => (
                <div key={i} className="p-2.5 flex items-start justify-between gap-3">
                  <div>
                    <span className="font-semibold text-slate-700">
                      Response #{err.index + 1}:
                    </span>{' '}
                    <span className="text-rose-600">{err.error}</span>
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

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div
          className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4 animate-in fade-in duration-100"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-2xl space-y-4 focus:outline-none">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-rose-700">
                <AlertCircle className="w-5 h-5 shrink-0" strokeWidth={2} />
                <h4 className="text-sm font-semibold text-slate-900">Cancel Job?</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to stop this submission job? Any in-flight submission will finish, and remaining submissions will be aborted.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowCancelModal(false)}
              >
                Keep Running
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
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
