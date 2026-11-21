import React from 'react';
import { Check } from 'lucide-react';

export default function Stepper({ steps = [], activeStep, onSelectStep, variant = 'all' }) {
  const showMobile = variant === 'all' || variant === 'mobile';
  const showDesktop = variant === 'all' || variant === 'desktop';

  return (
    <>
      {/* Mobile Horizontal Progress Bar (< 768px) */}
      {showMobile && (
        <div className="md:hidden w-full bg-white border-b border-slate-200 px-4 py-2.5">
          <div className="flex items-center justify-between mb-2 text-xs">
            <span className="font-semibold text-slate-900">
              Step {activeStep} of {steps.length}: {steps.find((s) => s.id === activeStep)?.title}
            </span>
            <span className="text-slate-400 font-mono text-[11px]">
              {Math.round((activeStep / steps.length) * 100)}%
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {steps.map((step) => {
              const isDone = step.status === 'done';
              const isCurrent = step.status === 'current';
              return (
                <button
                  key={step.id}
                  type="button"
                  disabled={!step.clickable}
                  onClick={() => step.clickable && onSelectStep(step.id)}
                  className={`h-1.5 rounded-full transition-colors ${
                    isCurrent
                      ? 'bg-blue-600'
                      : isDone
                      ? 'bg-blue-200 cursor-pointer hover:bg-blue-300'
                      : 'bg-slate-200 cursor-not-allowed'
                  }`}
                  title={`${step.title} (${step.status})`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Desktop Vertical Stepper (>= 768px) */}
      {showDesktop && (
        <nav aria-label="Progress" className="hidden md:block w-48 shrink-0">
          <ol className="space-y-4">
            {steps.map((step, index) => {
              const isCurrent = step.status === 'current';
              const isDone = step.status === 'done';
              const isClickable = step.clickable;

              return (
                <li key={step.id} className="relative">
                  {/* Connecting line between steps */}
                  {index !== steps.length - 1 && (
                    <div
                      aria-hidden="true"
                      className={`absolute top-6 left-2.5 -ml-px w-0.5 h-6 transition-colors ${
                        isDone ? 'bg-blue-200' : 'bg-slate-200'
                      }`}
                    />
                  )}

                  <button
                    type="button"
                    disabled={!isClickable}
                    onClick={() => isClickable && onSelectStep(step.id)}
                    className={`group w-full flex items-start text-left gap-3 select-none transition-opacity ${
                      isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                    }`}
                  >
                    {/* Step icon / number */}
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors mt-0.5 ${
                        isDone
                          ? 'bg-blue-50 text-blue-600 border border-blue-200 group-hover:bg-blue-100'
                          : isCurrent
                          ? 'bg-blue-600 text-white shadow-none'
                          : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}
                    >
                      {isDone ? (
                        <Check className="w-3 h-3 text-blue-600" strokeWidth={2.2} />
                      ) : (
                        step.id
                      )}
                    </span>

                    {/* Step label & summary */}
                    <div className="flex flex-col">
                      <span
                        className={`text-xs font-semibold tracking-tight leading-snug ${
                          isCurrent
                            ? 'text-blue-600'
                            : isDone
                            ? 'text-slate-800 group-hover:text-slate-950'
                            : 'text-slate-400'
                        }`}
                      >
                        {step.title}
                      </span>
                      <span className="text-[11px] text-slate-400 leading-tight">
                        {step.description}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}
    </>
  );
}
