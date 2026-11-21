import { useState } from 'react';

export const STEPS = [
  { id: 1, key: 'form', title: 'Form', description: 'URL & fields' },
  { id: 2, key: 'configure', title: 'Configure', description: 'Mix & overrides' },
  { id: 3, key: 'review', title: 'Review', description: 'Dry run sample' },
  { id: 4, key: 'run', title: 'Run', description: 'Live submission' },
];

/**
 * Single source of truth for step progression and completion state.
 *
 * Rules:
 * - Form (1): done when a form is loaded (Boolean(data)).
 * - Configure (2): done once user pressed Continue on step 2 (configured === true).
 * - Review (3): done when dry run generated (Boolean(previewResult)) or skipped (dryRunSkipped === true).
 * - Run (4): done only when a job for the current form has status "completed".
 * - Steps whose prerequisite isn't met are DISABLED (grey, not clickable, no check).
 * - Current step highlighted.
 * - Done steps are clickable.
 */
export default function useStep({
  data = null,
  previewResult = null,
  job = null,
  configured = false,
  setConfigured = () => {},
  dryRunSkipped = false,
  setDryRunSkipped = () => {},
}) {
  const [activeStep, setActiveStep] = useState(1);

  // Completion statuses
  const isFormDone = Boolean(data);
  const isConfigureDone = isFormDone && Boolean(configured);
  const isReviewDone = isConfigureDone && (Boolean(previewResult) || Boolean(dryRunSkipped));
  const isRunDone = job?.status === 'completed';

  // Prerequisites
  const isStepPrerequisiteMet = (stepId) => {
    switch (stepId) {
      case 1:
        return true;
      case 2:
        return isFormDone;
      case 3:
        return isConfigureDone;
      case 4:
        return isReviewDone;
      default:
        return false;
    }
  };

  const isStepDone = (stepId) => {
    switch (stepId) {
      case 1:
        return isFormDone;
      case 2:
        return isConfigureDone;
      case 3:
        return isReviewDone;
      case 4:
        return isRunDone;
      default:
        return false;
    }
  };

  const canGoToStep = (stepId) => {
    if (stepId === 1) return true;
    if (stepId === activeStep) return true;
    if (isStepDone(stepId)) return true;
    return isStepPrerequisiteMet(stepId);
  };

  const goToStep = (stepId) => {
    if (canGoToStep(stepId)) {
      setActiveStep(stepId);
    }
  };

  const resetFlags = () => {
    setConfigured(false);
    setDryRunSkipped(false);
    setActiveStep(1);
  };

  const stepsWithState = STEPS.map((step) => {
    const done = isStepDone(step.id);
    const prereqMet = isStepPrerequisiteMet(step.id);
    const isCurrent = step.id === activeStep;

    let status = 'disabled';
    let clickable = false;

    if (isCurrent) {
      status = 'current';
      clickable = true;
    } else if (done) {
      status = 'done';
      clickable = true;
    } else if (prereqMet) {
      status = 'available';
      clickable = true;
    } else {
      status = 'disabled';
      clickable = false;
    }

    return {
      ...step,
      isDone: done,
      status,
      clickable,
    };
  });

  return {
    activeStep,
    setActiveStep,
    goToStep,
    canGoToStep,
    steps: stepsWithState,
    isFormDone,
    isConfigureDone,
    isReviewDone,
    isRunDone,
    resetFlags,
    isFirstStep: activeStep === 1,
    isLastStep: activeStep === 4,
  };
}
