import React, { useEffect, useState } from 'react';
import client from '../api/client';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Sparkles, FileText, ChevronDown, ChevronUp } from 'lucide-react';

export default function SummaryPanel({
  data = null,
  settings = {},
  activeStep = 1,
  formKey = null,
  onPrimaryAction = null,
  primaryActionLabel = '',
  primaryActionLoading = false,
  primaryActionDisabled = false,
  onReset = null,
}) {
  const [prewarmStatus, setPrewarmStatus] = useState(null);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  // Poll prewarm status when formKey is available
  useEffect(() => {
    if (!formKey) {
      setPrewarmStatus(null);
      return;
    }

    let isMounted = true;
    let timer = null;

    async function checkStatus() {
      try {
        const res = await client.get(`/api/prewarm/${formKey}`);
        const status = res.data?.data?.status;
        if (!isMounted) return;

        if (status) {
          setPrewarmStatus(status);
        }

        if (status === 'warming' || status === 'idle') {
          timer = setTimeout(checkStatus, 2000);
        }
      } catch {
        if (isMounted) setPrewarmStatus('failed');
      }
    }

    checkStatus();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [formKey]);

  const mix = settings?.mix || { positive: 70, neutral: 20, negative: 10 };
  const count = settings?.count || 10;
  const questionsCount = data?.questions?.length || 0;

  const content = (
    <div className="space-y-4">
      {/* Form Title & ID */}
      <div>
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block mb-1">
          Target Form
        </span>
        {data ? (
          <div>
            <h4 className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2" title={data.title}>
              {data.title || 'Untitled Form'}
            </h4>
            {data.description && (
              <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                {data.description}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No form loaded yet</p>
        )}
      </div>

      <div className="h-px bg-slate-100" />

      {/* Metric details */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-[11px] text-slate-400 block">Questions</span>
          <span className="font-semibold text-slate-900 mt-0.5 block">
            {data ? `${questionsCount} fields` : '—'}
          </span>
        </div>
        <div>
          <span className="text-[11px] text-slate-400 block">Planned Count</span>
          <span className="font-semibold text-slate-900 mt-0.5 block">
            {data ? `${count} responses` : '—'}
          </span>
        </div>
      </div>

      {/* AI Prewarm Status */}
      {data && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-slate-400">AI Generation</span>
            {prewarmStatus === 'warming' && (
              <Badge variant="info" dot>
                Preparing answers
              </Badge>
            )}
            {(prewarmStatus === 'ready' || prewarmStatus === 'partial') && (
              <Badge variant="success" dot>
                AI answers ready
              </Badge>
            )}
            {prewarmStatus === 'failed' && (
              <Badge variant="neutral">
                Basic templates
              </Badge>
            )}
            {!prewarmStatus && (
              <Badge variant="neutral">Idle</Badge>
            )}
          </div>
        </div>
      )}

      {/* Sentiment Mix Bar */}
      {data && (
        <div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
            <span>Sentiment Distribution</span>
            <span className="font-mono text-[10px] text-slate-400">
              {mix.positive}/{mix.neutral}/{mix.negative}
            </span>
          </div>

          {/* Stacked bar */}
          <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-100">
            <div
              className="bg-emerald-500 h-full transition-all"
              style={{ width: `${mix.positive}%` }}
              title={`Positive: ${mix.positive}%`}
            />
            <div
              className="bg-slate-400 h-full transition-all"
              style={{ width: `${mix.neutral}%` }}
              title={`Neutral: ${mix.neutral}%`}
            />
            <div
              className="bg-rose-500 h-full transition-all"
              style={{ width: `${mix.negative}%` }}
              title={`Negative: ${mix.negative}%`}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Pos
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Neu
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Neg
            </span>
          </div>
        </div>
      )}

      {/* Primary Action Button */}
      {onPrimaryAction && primaryActionLabel && (
        <div className="pt-2">
          <Button
            variant="primary"
            size="md"
            className="w-full"
            loading={primaryActionLoading}
            disabled={primaryActionDisabled}
            onClick={onPrimaryAction}
          >
            {primaryActionLabel}
          </Button>
        </div>
      )}

      {/* Reset button if form loaded */}
      {data && onReset && (
        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            Clear and load another form
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Panel (>= 1024px) */}
      <aside className="hidden lg:block w-72 shrink-0">
        <div className="sticky top-20 bg-white border border-slate-200 rounded-[8px] p-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Job Summary
            </h3>
            <span className="text-[11px] text-slate-400">Step {activeStep} of 4</span>
          </div>
          {content}
        </div>
      </aside>

      {/* Mobile Collapsible Bar (< 1024px) */}
      {data && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-slate-200 shadow-lg">
          <button
            type="button"
            onClick={() => setMobileExpanded(!mobileExpanded)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-xs text-slate-700 font-medium cursor-pointer"
          >
            <div className="flex items-center gap-2 truncate">
              <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" strokeWidth={1.75} />
              <span className="truncate">{data.title || 'Job Summary'}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 text-slate-500">
              <span>{count} responses</span>
              {mobileExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </div>
          </button>

          {mobileExpanded && (
            <div className="px-4 pb-4 border-t border-slate-100 pt-3 max-h-80 overflow-y-auto">
              {content}
            </div>
          )}
        </div>
      )}
    </>
  );
}

