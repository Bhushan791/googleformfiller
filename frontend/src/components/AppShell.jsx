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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Header />
      <AIBanner />

      {/* Stepper on Mobile (horizontal bar) */}
      <Stepper
        steps={steps}
        activeStep={activeStep}
        onSelectStep={onSelectStep}
        variant="mobile"
      />

      {/* Main 3-column / 2-column layout container */}
      <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-8 flex flex-col md:flex-row items-start gap-6 lg:gap-8">
        {/* Left Vertical Stepper (Desktop only) */}
        <Stepper
          steps={steps}
          activeStep={activeStep}
          onSelectStep={onSelectStep}
          variant="desktop"
        />

        {/* Center Main Step Content */}
        <main className="flex-1 w-full min-w-0">
          {children}
        </main>

        {/* Right Summary Panel (displayed on Step 3 and Step 4 for context & persistent CTA) */}
        {(activeStep === 3 || activeStep === 4) && (
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
        )}
      </div>
    </div>
  );
}
