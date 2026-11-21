import { useState, useCallback } from 'react';
import AppShell from './components/AppShell';
import FormUrlInput from './components/FormUrlInput';
import FormSummary from './components/FormSummary';
import QuestionList from './components/QuestionList';
import ConfigureSettingsCard from './components/ConfigureSettingsCard';
import QuestionSkeleton from './components/QuestionSkeleton';
import ErrorMessage from './components/ErrorMessage';
import UnsupportedWarning from './components/UnsupportedWarning';
import DryRunTable from './components/DryRunTable';
import StartJobPanel from './components/StartJobPanel';
import JobDashboard from './components/JobDashboard';
import Button from './components/ui/Button';
import useParseForm from './hooks/useParseForm';
import useSettings from './hooks/useSettings';
import useJob from './hooks/useJob';
import useStep from './hooks/useStep';
import { previewResponses } from './api/preview';
import { createJob } from './api/jobs';
import { useToast } from './components/ui/Toast';
import { ArrowLeft, ArrowRight, Play, RotateCcw, Sparkles } from 'lucide-react';

const STEP_METADATA = {
  1: {
    title: 'Connect Form',
    description: 'Paste any public Google Forms link to inspect its fields and structure.',
  },
  2: {
    title: 'Configure Responses',
    description: 'Set tone distribution, customize per-question logic, and adjust submission parameters.',
  },
  3: {
    title: 'Review Sample Data',
    description: 'Inspect 5 dry-run preview responses to verify formatting, variety, and tone.',
  },
  4: {
    title: 'Submit Responses',
    description: 'Execute sequential, paced submissions directly to your Google Form.',
  },
};

export default function App() {
  const { addToast } = useToast();
  const [submittedUrl, setSubmittedUrl] = useState(null);
  const { data, loading, error, parse, reset } = useParseForm();

  const {
    settings,
    setMix,
    setCount,
    setQuestionOverride,
    addPool,
    removePool,
    setOptionalSkipRate,
    loadSettings,
  } = useSettings();

  const [delay, setDelay] = useState({ minMs: 2000, maxMs: 6000 });

  const [previewResult, setPreviewResult] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  // Active Job state (restored from localStorage)
  const [activeJobId, setActiveJobId] = useState(() => {
    try {
      return localStorage.getItem('formbot_active_job_id');
    } catch {
      return null;
    }
  });

  const {
    job,
    loading: jobLoading,
    error: jobError,
    actionLoading,
    pause: pauseJob,
    resume: resumeJob,
    cancel: cancelJob,
  } = useJob(activeJobId);

  const [startJobLoading, setStartJobLoading] = useState(false);
  const [startJobError, setStartJobError] = useState(null);

  const {
    activeStep,
    goToStep,
    steps,
  } = useStep({
    data,
    previewResult,
    activeJobId,
  });

  const handleSubmit = (url) => {
    setSubmittedUrl(url);
    setPreviewResult(null);
    setPreviewError(null);
    parse(url);
  };

  const handleRetry = () => {
    setSubmittedUrl(null);
    setPreviewResult(null);
    setPreviewError(null);
    reset();
    goToStep(1);
    addToast('Cleared active form', 'info');
  };

  const handleRunPreview = useCallback(async () => {
    if (!data?.questions?.length) return;
    setPreviewLoading(true);
    setPreviewError(null);
    goToStep(3);

    try {
      const res = await previewResponses(data.questions, settings, data.formKey);
      setPreviewResult(res.data);
      addToast('Generated 5 sample responses', 'success');
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        'Failed to generate preview responses. Please try again.';
      setPreviewError(msg);
      addToast(msg, 'error');
    } finally {
      setPreviewLoading(false);
    }
  }, [data, settings, goToStep, addToast]);

  const handleStartJob = async () => {
    if (!submittedUrl) return;
    setStartJobLoading(true);
    setStartJobError(null);

    try {
      const res = await createJob({
        formUrl: submittedUrl,
        count: settings.count,
        settings,
        delay,
      });

      const newJobId = res.data.jobId;
      setActiveJobId(newJobId);
      try {
        localStorage.setItem('formbot_active_job_id', newJobId);
      } catch (e) {
        console.warn('Failed to save active jobId to localStorage', e);
      }
      goToStep(4);
      addToast(`Job #${newJobId.slice(0, 8)} started`, 'success');
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        err.message ||
        'Failed to start job.';
      setStartJobError(msg);
      addToast(msg, 'error');
    } finally {
      setStartJobLoading(false);
    }
  };

  const handleClearActiveJob = () => {
    setActiveJobId(null);
    try {
      localStorage.removeItem('formbot_active_job_id');
    } catch (e) {
      console.warn('Failed to clear jobId from localStorage', e);
    }
    addToast('Job session reset', 'info');
  };

  const handleLoadTemplate = (template) => {
    if (template.settings) loadSettings(template.settings);
    if (template.count) setCount(template.count);
    if (template.delay) setDelay(template.delay);
  };

  // Determine SummaryPanel Primary Action based on step
  let primaryActionLabel = '';
  let onPrimaryAction = null;
  let primaryActionLoading = false;
  let primaryActionDisabled = false;

  if (activeStep === 3 && data) {
    primaryActionLabel = 'Continue to Run →';
    onPrimaryAction = () => goToStep(4);
    primaryActionDisabled = previewLoading;
  } else if (activeStep === 4 && !activeJobId && data) {
    primaryActionLabel = 'Start Submissions';
    onPrimaryAction = handleStartJob;
    primaryActionLoading = startJobLoading;
  }

  const currentStepMeta = STEP_METADATA[activeStep] || STEP_METADATA[1];

  return (
    <AppShell
      steps={steps}
      activeStep={activeStep}
      onSelectStep={goToStep}
      data={data}
      settings={settings}
      formKey={data?.formKey}
      onPrimaryAction={onPrimaryAction}
      primaryActionLabel={primaryActionLabel}
      primaryActionLoading={primaryActionLoading}
      primaryActionDisabled={primaryActionDisabled}
      onReset={handleRetry}
    >
      <div className="space-y-6">
        {/* Consistent Step Page Title & Description */}
        <div className="border-b border-slate-200 pb-3">
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
            {currentStepMeta.title}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {currentStepMeta.description}
          </p>
        </div>

        {/* STEP 1: FORM */}
        {activeStep === 1 && (
          <div className="space-y-6">
            {!data && !loading && (
              <FormUrlInput onSubmit={handleSubmit} loading={loading} />
            )}

            {loading && <QuestionSkeleton />}

            {error && <ErrorMessage error={error} onRetry={handleRetry} />}

            {data && (
              <div className="space-y-4">
                <FormSummary
                  title={data.title}
                  description={data.description}
                  questionCount={data.questions?.length ?? 0}
                  unsupportedCount={data.unsupported?.length ?? 0}
                  formKey={data.formKey}
                  onContinue={() => goToStep(2)}
                  showContinue={true}
                />

                <div className="flex justify-start">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRetry}
                  >
                    Try another link
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: CONFIGURE (Two-column on desktop, single on mobile) */}
        {activeStep === 2 && data && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left / Main: Questions (7 cols on lg) */}
              <div className="lg:col-span-7 space-y-4">
                {data.unsupported?.length > 0 && (
                  <UnsupportedWarning items={data.unsupported} />
                )}

                <QuestionList
                  questions={data.questions}
                  overrides={settings.perQuestion}
                  onOverrideChange={setQuestionOverride}
                  pools={settings.pools}
                />
              </div>

              {/* Right / Side: Settings Card (5 cols on lg) */}
              <div className="lg:col-span-5 space-y-4">
                <ConfigureSettingsCard
                  formId={data.formId}
                  settings={settings}
                  onMixChange={setMix}
                  onCountChange={setCount}
                  onSkipRateChange={setOptionalSkipRate}
                  onAddPool={addPool}
                  onRemovePool={removePool}
                  onLoadTemplate={handleLoadTemplate}
                  delay={delay}
                />
              </div>
            </div>

            {/* Step 2 Bottom Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRetry}
              >
                Change Form
              </Button>

              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleRunPreview}
                loading={previewLoading}
                disabled={!data.questions?.length}
                icon={ArrowRight}
              >
                Preview Responses
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: REVIEW (Dry Run) */}
        {activeStep === 3 && data && (
          <div className="space-y-6">
            {previewLoading && (
              <div className="rounded-lg border border-slate-200 bg-white p-12 text-center space-y-3">
                <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                <p className="text-xs font-medium text-slate-600">
                  Synthesizing 5 sample responses with configured tone mix...
                </p>
              </div>
            )}

            {previewError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 space-y-2">
                <p className="text-xs font-semibold text-rose-800">Preview Generation Error</p>
                <p className="text-xs text-rose-700">{previewError}</p>
                <Button variant="secondary" size="sm" onClick={handleRunPreview} icon={RotateCcw}>
                  Retry Generation
                </Button>
              </div>
            )}

            {!previewResult && !previewLoading && !previewError && (
              <div className="rounded-lg border border-slate-200 bg-white p-10 text-center space-y-3">
                <p className="text-xs text-slate-500">
                  No preview has been generated yet for this configuration.
                </p>
                <Button variant="primary" size="sm" onClick={handleRunPreview} icon={Sparkles}>
                  Generate Preview Sample
                </Button>
              </div>
            )}

            {previewResult && !previewLoading && (
              <DryRunTable
                responses={previewResult.responses}
                questions={data.questions}
                metadata={previewResult.metadata}
                onRegenerate={handleRunPreview}
                loading={previewLoading}
              />
            )}

            {/* Step 3 Navigation Controls */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => goToStep(2)}
                icon={ArrowLeft}
              >
                Back to Configure
              </Button>

              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => goToStep(4)}
                disabled={previewLoading || !previewResult}
                icon={ArrowRight}
              >
                Continue to Run
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: RUN */}
        {activeStep === 4 && (
          <div className="space-y-6">
            {activeJobId ? (
              <JobDashboard
                job={job}
                onPause={pauseJob}
                onResume={resumeJob}
                onCancel={cancelJob}
                onClear={handleClearActiveJob}
                actionLoading={actionLoading}
              />
            ) : (
              <div className="space-y-6">
                <StartJobPanel
                  formUrl={submittedUrl}
                  count={settings.count}
                  onCountChange={setCount}
                  delay={delay}
                  onDelayChange={setDelay}
                  hasDryRun={Boolean(previewResult)}
                  onStartJob={handleStartJob}
                  loading={startJobLoading}
                  error={startJobError}
                />

                <div className="flex items-center justify-start pt-2 border-t border-slate-200">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => goToStep(3)}
                    icon={ArrowLeft}
                  >
                    Back to Review
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
