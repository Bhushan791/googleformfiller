import React from 'react';
import Header from './Header';
import AIBanner from './AIBanner';
import Stepper from './Stepper';
import SummaryPanel from './SummaryPanel';

export default function AppShell({
  children,
  steps = [],
  activeStep = 1,
  onSelectStep,
  data = null,
  settings = {},
  formKey = null,
  onPrimaryAction = null,
  primaryActionLabel = '',
  primaryActionLoading = false,
  primaryActionDisabled = false,
  onReset = null,
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans overflow-x-hidden">
      {/* Top Bar */}
      <Header onNavigateHome={() => onSelectStep?.(1)} />

      {/* AI Off status banner (subtle, if keys missing) */}
      <AIBanner />

      {/* Full-width Horizontal Stepper directly under Top Bar */}
      <Stepper
        steps={steps}
        activeStep={activeStep}
        onSelectStep={onSelectStep}
      />

      {/* Content Container (max-w-6xl, 24px gaps) */}
      <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-8">
        {activeStep === 1 ? (
          // Step 1: No Summary Panel, single main column
          <main className="w-full">
            {children}
          </main>
        ) : (
          // Steps 2-4: Main column + Sticky Right Summary Panel (320px) on >=1024px
          <div className="flex flex-col lg:flex-row items-start gap-6 pb-20 lg:pb-0">
            <main className="flex-1 w-full min-w-0">
              {children}
            </main>

            <SummaryPanel
              data={data}
              settings={settings}
              activeStep={activeStep}
              formKey={formKey}
              onPrimaryAction={onPrimaryAction}
              primaryActionLabel={primaryActionLabel}
              primaryActionLoading={primaryActionLoading}
              primaryActionDisabled={primaryActionDisabled}
              onReset={onReset}
            />
          </div>
        )}
      </div>

      {/* Slim Footer */}
      <footer className="py-5 text-center text-xs text-slate-400 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-center gap-2.5">
        <img
          src="/logo.png"
          alt="Autofillr"
          className="h-6 w-auto object-contain opacity-80"
        />
        <span>Autofillr - for testing and demo data on forms you own.</span>
      </footer>
    </div>
  );
}
