import { useState, useEffect } from 'react';

export const STEPS = [
  { id: 1, key: 'form', title: 'Form', description: 'URL & fields' },
  { id: 2, key: 'configure', title: 'Configure', description: 'Mix & overrides' },
  { id: 3, key: 'review', title: 'Review', description: 'Dry run sample' },
  { id: 4, key: 'run', title: 'Run', description: 'Live submission' },
];

/**
 * Derives the active step from existing app state and allows navigating back to completed steps.
 */
export default function useStep({
  data = null,
  previewResult = null,
  activeJobId = null,
}) {
  // Determine highest step unlocked based on app state
  const getMaxUnlockedStep = () => {
    if (activeJobId) return 4;
    if (previewResult) return 4;
    if (data) return 3;
    return 1;
  };

  const [activeStep, setActiveStep] = useState(() => {
    if (activeJobId) return 4;
    if (previewResult) return 3;
    if (data) return 2;
    return 1;
  });

  // Automatically advance when forward state changes
  useEffect(() => {
    if (activeJobId) {
      setActiveStep(4);
    } else if (previewResult && activeStep < 3) {
      setActiveStep(3);
    } else if (data && activeStep < 2) {
      setActiveStep(2);
    } else if (!data && !activeJobId) {
      setActiveStep(1);
    }
  }, [data, previewResult, activeJobId]);

  const maxUnlocked = getMaxUnlockedStep();

  const canGoToStep = (stepId) => {
    return stepId <= maxUnlocked;
  };

  const goToStep = (stepId) => {
    if (canGoToStep(stepId)) {
      setActiveStep(stepId);
    }
  };

  const stepsWithState = STEPS.map((step) => {
    let status = 'upcoming';
    if (step.id === activeStep) {
      status = 'current';
    } else if (step.id < activeStep || (step.id <= maxUnlocked && step.id !== activeStep)) {
      status = 'done';
    }

    return {
      ...step,
      status,
      clickable: canGoToStep(step.id),
    };
  });

  return {
    activeStep,
    goToStep,
    canGoToStep,
    steps: stepsWithState,
    isFirstStep: activeStep === 1,
    isLastStep: activeStep === 4,
  };
}

