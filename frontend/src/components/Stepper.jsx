import React from 'react';
import { Check } from 'lucide-react';

/**
 * Full-width horizontal stepper located directly below the top bar.
 * - >=768px (Desktop/Tablet): Number circle + label + one-line caption with connector lines
 * - <768px (Mobile): Number circles with only the current label visible + connector lines
 */
export default function Stepper({ steps = [], activeStep, onSelectStep }) {
  return (
    <nav
      aria-label="Workflow progress"
      className="w-full bg-white border-b border-slate-200 select-none sticky top-14 z-20"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3">
        {/* Desktop & Tablet view (>= 768px) */}
        <ol className="hidden md:flex items-center justify-between w-full">
          {steps.map((step, index) => {
            const isCurrent = step.status === 'current';
            const isDone = step.status === 'done';
            const isClickable = step.clickable;

            return (
              <React.Fragment key={step.id}>
                <li className="flex items-center shrink-0">
                  <button
                    type="button"
                    disabled={!isClickable}
                    onClick={() => isClickable && onSelectStep(step.id)}
                    className={`flex items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded-md ${
                      isClickable
                        ? 'cursor-pointer group'
                        : 'cursor-not-allowed opacity-50'
                    }`}
                  >
                    {/* Circle */}
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                        isDone
                          ? 'bg-blue-50 text-blue-600 border border-blue-200 group-hover:bg-blue-100'
                          : isCurrent
                          ? 'bg-blue-600 text-white shadow-none ring-2 ring-blue-600/20'
                          : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}
                    >
                      {isDone ? (
                        <Check className="w-3.5 h-3.5 text-blue-600" strokeWidth={2.5} />
                      ) : (
                        step.id
                      )}
                    </span>

                    {/* Label & Caption */}
                    <div className="flex flex-col">
                      <span
                        className={`text-xs font-semibold tracking-tight leading-tight transition-colors ${
                          isCurrent
                            ? 'text-blue-600'
                            : isDone
                            ? 'text-slate-900 group-hover:text-blue-600'
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

                {/* Connector line between steps */}
                {index < steps.length - 1 && (
                  <li className="flex-1 mx-3 sm:mx-4" aria-hidden="true">
                    <div
                      className={`h-px w-full transition-colors ${
                        isDone ? 'bg-blue-300' : 'bg-slate-200'
                      }`}
                    />
                  </li>
                )}
              </React.Fragment>
            );
          })}
        </ol>

        {/* Mobile view (< 768px) */}
        <div className="md:hidden flex items-center justify-between w-full">
          {steps.map((step, index) => {
            const isCurrent = step.status === 'current';
            const isDone = step.status === 'done';
            const isClickable = step.clickable;

            return (
              <React.Fragment key={step.id}>
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && onSelectStep(step.id)}
                  className={`flex items-center gap-1.5 focus:outline-none ${
                    isClickable
                      ? 'cursor-pointer'
                      : 'cursor-not-allowed opacity-50'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                      isDone
                        ? 'bg-blue-50 text-blue-600 border border-blue-200'
                        : isCurrent
                        ? 'bg-blue-600 text-white font-semibold ring-2 ring-blue-600/20'
                        : 'bg-slate-100 text-slate-400 border border-slate-200'
                    }`}
                  >
                    {isDone ? (
                      <Check className="w-3.5 h-3.5 text-blue-600" strokeWidth={2.5} />
                    ) : (
                      step.id
                    )}
                  </span>

                  {isCurrent && (
                    <span className="text-xs font-semibold text-blue-600 whitespace-nowrap">
                      {step.title}
                    </span>
                  )}
                </button>

                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-px mx-2 transition-colors ${
                      isDone ? 'bg-blue-300' : 'bg-slate-200'
                    }`}
                    aria-hidden="true"
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
