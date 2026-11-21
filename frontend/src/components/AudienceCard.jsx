import React from 'react';
import Badge from './ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Sparkles, HelpCircle } from 'lucide-react';

const AUDIENCE_OPTIONS = [
  { id: 'auto', label: 'Auto-detect' },
  { id: 'prelaunch', label: 'Not launched yet' },
  { id: 'launched', label: 'Already launched' },
  { id: 'event', label: 'Event or service attended' },
  { id: 'research', label: 'General research' },
  { id: 'custom', label: 'Custom note' },
];

const MODE_LABELS = {
  prelaunch: 'Not launched yet',
  launched: 'Already launched',
  event: 'Event or service attended',
  research: 'General research',
  custom: 'Custom note',
};

export default function AudienceCard({
  audienceMode = 'auto',
  scenario = '',
  onAudienceModeChange,
  onScenarioChange,
  detectionInfo = null,
}) {
  const currentMode = audienceMode || 'auto';
  const detectedMode = detectionInfo?.detectedMode;
  const confidencePct = Math.round((detectionInfo?.confidence || 0) * 100);
  const detectedLabel = MODE_LABELS[detectedMode] || detectedMode;
  const reason = detectionInfo?.reason || '';

  return (
    <Card>
      <CardHeader className="p-5 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900">
              What is this form about?
            </CardTitle>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Tells the AI what kind of answers to write.
            </p>
          </div>

          {/* Detected Badge when in Auto mode */}
          {currentMode === 'auto' && (
            <div className="shrink-0 flex items-center gap-1.5">
              {detectedMode ? (
                <div title={reason} className="inline-flex cursor-help">
                  <Badge variant="info" dot className="text-xs py-0.5 px-2">
                    Detected: {detectedLabel} ({confidencePct}%)
                  </Badge>
                </div>
              ) : detectionInfo?.status === 'warming' ? (
                <Badge variant="neutral" dot className="text-xs py-0.5 px-2">
                  Detecting audience...
                </Badge>
              ) : null}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-2 space-y-4">
        {/* Segmented Control */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 p-1 bg-slate-100/80 rounded-lg border border-slate-200/80">
          {AUDIENCE_OPTIONS.map((opt) => {
            const isSelected = currentMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onAudienceModeChange?.(opt.id)}
                className={`py-1.5 px-2.5 text-xs font-medium rounded-md transition-all text-center truncate cursor-pointer ${
                  isSelected
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50 border border-transparent'
                }`}
                title={opt.label}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Custom note textarea */}
        {currentMode === 'custom' && (
          <div className="space-y-1.5 pt-1 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <label htmlFor="custom-scenario-input" className="text-xs font-semibold text-slate-700">
                Custom Scenario Description
              </label>
              <span className="text-[11px] font-mono text-slate-400">
                {(scenario || '').length}/400
              </span>
            </div>
            <textarea
              id="custom-scenario-input"
              rows={3}
              maxLength={400}
              value={scenario || ''}
              onChange={(e) => onScenarioChange?.(e.target.value)}
              placeholder="Describe the respondent persona, background, or specific context (e.g. college students cooking on a strict weekly budget)..."
              className="w-full rounded-md border border-slate-200 bg-white p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 leading-relaxed"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

