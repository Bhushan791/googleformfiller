import React, { useEffect, useState } from 'react';
import client from '../api/client';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { Sliders, X } from 'lucide-react';

export default function SummaryPanel({
  data = null,
  settings = {},
  activeStep = 2,
  formKey = null,
  onPrimaryAction = null,
  primaryActionLabel = '',
  primaryActionLoading = false,
  primaryActionDisabled = false,
  onReset = null,
}) {
  const [prewarmStatus, setPrewarmStatus] = useState(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

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
  const posVal = mix?.positive ?? 70;
  const neuVal = mix?.neutral ?? 20;
  const negVal = mix?.negative ?? 10;
  const count = settings?.count || 10;
  const questionsCount = data?.questions?.length || 0;

  const summaryContent = (
    <div className="space-y-4">
      {/* 1. Form Section */}
      <div>
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block mb-1">
          Form
        </span>
        {data ? (
          <div>
            <h4
              className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2"
              title={data.title}
            >
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

      {/* 2. Stats Grid (Questions, Responses - single instance) */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-50 border border-slate-200/80 rounded-md p-2.5">
          <span className="text-[11px] text-slate-500 block">Questions</span>
          <span className="text-xs font-semibold text-slate-900 mt-0.5 block">
            {data ? `${questionsCount} fields` : '—'}
          </span>
        </div>
        <div className="bg-slate-50 border border-slate-200/80 rounded-md p-2.5">
          <span className="text-[11px] text-slate-500 block">Responses</span>
          <span className="text-xs font-semibold text-slate-900 mt-0.5 block">
            {data ? `${count} planned` : '—'}
          </span>
        </div>
      </div>

      {/* 3. AI Status Chip */}
      {data && (
        <div className="flex items-center justify-between text-xs py-1.5 border-y border-slate-100">
          <span className="text-[11px] text-slate-500 font-medium">AI Status</span>
          {prewarmStatus === 'warming' && (
            <Badge variant="info" dot>
              Preparing answers
            </Badge>
          )}
          {(prewarmStatus === 'ready' || prewarmStatus === 'partial') && (
            <Badge variant="success" dot>
              Answers ready
            </Badge>
          )}
          {prewarmStatus === 'failed' && (
            <Badge variant="neutral">
              Fallback templates
            </Badge>
          )}
          {!prewarmStatus && (
            <Badge variant="neutral">Idle</Badge>
          )}
        </div>
      )}

      {/* 4. Mix Bar (Muted tints: green-500/60, slate-300, red-400/70, 8px high, rounded) */}
      {data && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Tone Mix</span>
            <span className="text-slate-700 font-medium text-[11px]">
              Positive {posVal}% / Neutral {neuVal}% / Negative {negVal}%
            </span>
          </div>

          {/* 8px high rounded stacked bar */}
          <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-100">
            <div
              className="bg-green-500/60 h-full transition-all"
              style={{ width: `${posVal}%` }}
              title={`Positive: ${posVal}%`}
            />
            <div
              className="bg-slate-300 h-full transition-all"
              style={{ width: `${neuVal}%` }}
              title={`Neutral: ${neuVal}%`}
            />
            <div
              className="bg-red-400/70 h-full transition-all"
              style={{ width: `${negVal}%` }}
              title={`Negative: ${negVal}%`}
            />
          </div>

          {/* Small legend */}
          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500/60" /> Positive
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-300" /> Neutral
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400/70" /> Negative
            </span>
          </div>
        </div>
      )}

      {/* 5. Primary Action for Current Step */}
      {onPrimaryAction && primaryActionLabel && (
        <div className="pt-2">
          <Button
            type="button"
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
      {/* Desktop Sticky Panel (>= 1024px, 320px wide) */}
      <aside className="hidden lg:block w-[320px] shrink-0">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-2">
              <img src="/logo-icon.png" alt="Autofillr" className="h-4 w-4 object-contain" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Summary
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Step {activeStep} of 4</span>
          </div>
          {summaryContent}
        </div>
      </aside>

      {/* Mobile Sticky Bottom Bar (< 1024px) */}
      {data && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => setMobileSheetOpen(true)}
            icon={Sliders}
          >
            Details
          </Button>

          {onPrimaryAction && primaryActionLabel ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              className="flex-1"
              loading={primaryActionLoading}
              disabled={primaryActionDisabled}
              onClick={onPrimaryAction}
            >
              {primaryActionLabel}
            </Button>
          ) : (
            <div className="flex-1 text-right text-xs text-slate-500 font-medium truncate">
              {count} planned responses
            </div>
          )}
        </div>
      )}

      {/* Mobile Bottom Sheet Modal */}
      {mobileSheetOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-t-xl border-t border-slate-200 p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Form & Job Details
              </h3>
              <button
                type="button"
                onClick={() => setMobileSheetOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer rounded"
                aria-label="Close details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {summaryContent}
          </div>
        </div>
      )}
    </>
  );
}
