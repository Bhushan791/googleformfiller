import { useState, useCallback, useEffect, useRef } from 'react';
import AppShell from './components/AppShell';
import FormUrlInput from './components/FormUrlInput';
import FormSummary from './components/FormSummary';
import AudienceCard from './components/AudienceCard';
import GenerationSettingsCard from './components/GenerationSettingsCard';
import QuestionList from './components/QuestionList';
import QuestionSkeleton from './components/QuestionSkeleton';
import ErrorMessage from './components/ErrorMessage';
import DryRunTable from './components/DryRunTable';
import StartJobPanel from './components/StartJobPanel';
import JobDashboard from './components/JobDashboard';
import Button from './components/ui/Button';
import useParseForm from './hooks/useParseForm';
import useSettings from './hooks/useSettings';
import useJob from './hooks/useJob';
import useStep from './hooks/useStep';
import { previewResponses } from './api/preview';
import { createJob, getJobStatus } from './api/jobs';
import { triggerPrewarm, getPrewarmStatus } from './api/forms';
import { useToast } from './components/ui/Toast';
import { ArrowLeft, ArrowRight, RotateCcw, Sparkles } from 'lucide-react';

const STEP_METADATA = {
  1: {
    title: 'Connect Form',
    description: 'Paste any public Google Forms link to inspect its fields and structure.',
  },
  2: {
    title: 'Configure Responses',
    description: 'Set audience context, tune generation parameters, and customize per-question logic.',
  },
  3: {
    title: 'Review Sample Data',
    description: 'Inspect dry-run preview responses to verify formatting, variety, and tone.',
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
    setAudienceMode,
    setScenario,
    setMix,
    setCount,
    setQuestionOverride,
    addPool,
    removePool,
    setOptionalSkipRate,
    loadSettings,
  } = useSettings();

  const [currentFormKey, setCurrentFormKey] = useState(null);
  const [prewarmInfo, setPrewarmInfo] = useState(null);

  // Sync currentFormKey when form data loads
  useEffect(() => {
    if (data?.formKey) {
      setCurrentFormKey(data.formKey);
    }
  }, [data?.formKey]);

  // Poll prewarm status whenever currentFormKey changes
  useEffect(() => {
    if (!currentFormKey) return;
    let timer = null;
    let isMounted = true;

    async function poll() {
      try {
        const res = await getPrewarmStatus(currentFormKey);
        if (!isMounted) return;
        if (res?.data) {
          setPrewarmInfo(res.data);
          if (res.data.status === 'warming' || res.data.status === 'idle') {
            timer = setTimeout(poll, 2000);
          }
        }
      } catch {
        // ignore polling error
      }
    }

    poll();
    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [currentFormKey]);

  const [delay, setDelay] = useState({ minMs: 2000, maxMs: 6000 });
  const [previewResult, setPreviewResult] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  // Stepper completion flags (useStep is single source of truth)
  const [configured, setConfigured] = useState(false);
  const [dryRunSkipped, setDryRunSkipped] = useState(false);

  // Stale job on load management
  const [activeJobId, setActiveJobId] = useState(null);
  const [runningJobBanner, setRunningJobBanner] = useState(false);
  const [lastJobLink, setLastJobLink] = useState(() => {
    try {
      const saved = localStorage.getItem('formbot_last_job');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const {
    job,
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
    job,
    configured,
    setConfigured,
    dryRunSkipped,
    setDryRunSkipped,
  });

  // Track initial load of job without ever auto-jumping to step 4
  useEffect(() => {
    let raw = null;
    try {
      raw = localStorage.getItem('formbot_active_job_id');
    } catch {}

    if (!raw) return;

    let mockedJob = null;
    let jobId = raw;

    if (raw.startsWith('{')) {
      try {
        mockedJob = JSON.parse(raw);
        jobId = mockedJob.id || mockedJob.jobId || 'mock_job';
      } catch {}
    }

    if (mockedJob) {
      if (mockedJob.status === 'running' || mockedJob.status === 'paused') {
        setActiveJobId(jobId);
        setRunningJobBanner(true);
      } else {
        localStorage.removeItem('formbot_active_job_id');
        setActiveJobId(null);
        const sub =
          mockedJob.submittedCount ?? mockedJob.progress?.submitted ?? mockedJob.submitted ?? 3;
        const tot =
          mockedJob.targetCount ?? mockedJob.count ?? mockedJob.total ?? 3;
        const last = { submitted: sub, total: tot, jobId, status: mockedJob.status };
        localStorage.setItem('formbot_last_job', JSON.stringify(last));
        setLastJobLink(last);
      }
      return;
    }

    // Query real job status from server
    let isMounted = true;
    getJobStatus(jobId)
      .then((res) => {
        if (!isMounted) return;
        const j = res?.data;
        if (j?.status === 'running' || j?.status === 'paused') {
          setActiveJobId(jobId);
          setRunningJobBanner(true);
        } else if (
          j?.status === 'completed' ||
          j?.status === 'failed' ||
          j?.status === 'cancelled'
        ) {
          localStorage.removeItem('formbot_active_job_id');
          setActiveJobId(null);
          const sub = j.submittedCount ?? j.progress?.submitted ?? j.count ?? 0;
          const tot = j.targetCount ?? j.count ?? 0;
          const last = { submitted: sub, total: tot, jobId, status: j.status };
          localStorage.setItem('formbot_last_job', JSON.stringify(last));
          setLastJobLink(last);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        localStorage.removeItem('formbot_active_job_id');
        setActiveJobId(null);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Update lastJobLink when an active job finishes
  useEffect(() => {
    if (job?.status === 'completed') {
      const sub = job.submittedCount ?? job.progress?.submitted ?? job.count ?? 0;
      const tot = job.targetCount ?? job.count ?? 0;
      const last = { submitted: sub, total: tot, jobId: job.id, status: 'completed' };
      try {
        localStorage.setItem('formbot_last_job', JSON.stringify(last));
      } catch {}
      setLastJobLink(last);
      setRunningJobBanner(false);
    }
  }, [job?.status, job?.id, job?.submittedCount, job?.targetCount, job?.count, job?.progress?.submitted]);

  // Automatically advance to Step 2 when a new form finishes loading
  const prevFormRef = useRef(null);
  useEffect(() => {
    if (data && data !== prevFormRef.current) {
      prevFormRef.current = data;
      goToStep(2);
    }
  }, [data, goToStep]);

  // Save to recent forms (last 5, only title + shortenedUrl + date + url)
  useEffect(() => {
    if (data && submittedUrl) {
      try {
        const stored = localStorage.getItem('formbot_recent_forms');
        const existing = stored ? JSON.parse(stored) : [];
        let shortened = submittedUrl;
        try {
          const u = new URL(submittedUrl);
          shortened = u.hostname + u.pathname.slice(0, 24) + '...';
        } catch {}
        const newItem = {
          title: data.title || 'Untitled Form',
          url: submittedUrl,
          shortenedUrl: shortened,
          date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        };
        const filtered = Array.isArray(existing)
          ? existing.filter((item) => item.url !== submittedUrl)
          : [];
        const updated = [newItem, ...filtered].slice(0, 5);
        localStorage.setItem('formbot_recent_forms', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save recent form:', e);
      }
    }
  }, [data, submittedUrl]);

  const handleSubmit = (url) => {
    setSubmittedUrl(url);
    setPreviewResult(null);
    setPreviewError(null);
    setConfigured(false);
    setDryRunSkipped(false);
    parse(url);
  };

  const handleRetry = () => {
    setSubmittedUrl(null);
    setPreviewResult(null);
    setPreviewError(null);
    setConfigured(false);
    setDryRunSkipped(false);
    reset();
    goToStep(1);
    addToast('Cleared active form', 'info');
  };

  // Validation for Step 2
  const mix = settings?.mix || { positive: 70, neutral: 20, negative: 10 };
  const mixSum = (mix.positive || 0) + (mix.neutral || 0) + (mix.negative || 0);
  const isMixValid = mixSum === 100 && mix.positive >= 0 && mix.neutral >= 0 && mix.negative >= 0;
  const isCountValid = typeof settings.count === 'number' && settings.count >= 1 && settings.count <= 500;
  
  let validationError = null;
  if (!isMixValid || !isCountValid) {
    validationError = 'Please enter a valid response count (1–500) and ensure sentiment mix sums to 100%.';
  }
  const isStep2Disabled = Boolean(validationError) || !data?.questions?.length || previewLoading;

  const handleRunPreview = useCallback(async () => {
    if (isStep2Disabled || !data?.questions?.length) return;
    setPreviewLoading(true);
    setPreviewError(null);
    setConfigured(true); // Pressing continue on step 2 marks step 2 as done
    goToStep(3);

    try {
      const res = await previewResponses(data.questions, settings, currentFormKey || data.formKey);
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
  }, [isStep2Disabled, data, settings, currentFormKey, goToStep, addToast]);

  const handleSkipToRun = () => {
    setDryRunSkipped(true);
    goToStep(4);
  };

  const handleAudienceChange = useCallback(
    async (newMode, newScenario) => {
      if (!data) return;
      const effMode = newMode !== undefined ? newMode : (settings.audienceMode || 'auto');
      const effScenario = newScenario !== undefined ? newScenario : (settings.scenario || '');

      if (newMode !== undefined) setAudienceMode(newMode);
      if (newScenario !== undefined) setScenario(newScenario);

      try {
        const res = await triggerPrewarm({
          formId: data.formId || submittedUrl,
          url: submittedUrl,
          questions: data.questions,
          formContext: { title: data.title, description: data.description },
          settings: {
            ...settings,
            audienceMode: effMode,
            scenario: effScenario,
          },
        });

        if (res?.data?.formKey) {
          setCurrentFormKey(res.data.formKey);
          setPrewarmInfo((prev) => ({ ...(prev || {}), status: 'warming' }));
        }
      } catch (err) {
        console.warn('Failed to re-trigger prewarm:', err);
      }
    },
    [data, submittedUrl, settings, setAudienceMode, setScenario]
  );

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
      setRunningJobBanner(false);
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
    setRunningJobBanner(false);
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

  if (activeStep === 2 && data) {
    primaryActionLabel = 'Continue to review';
    onPrimaryAction = handleRunPreview;
    primaryActionLoading = previewLoading;
    primaryActionDisabled = isStep2Disabled;
  } else if (activeStep === 3 && data) {
    primaryActionLabel = 'Continue to Run →';
    onPrimaryAction = handleSkipToRun;
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
      formKey={currentFormKey || data?.formKey}
      onPrimaryAction={onPrimaryAction}
      primaryActionLabel={primaryActionLabel}
      primaryActionLoading={primaryActionLoading}
      primaryActionDisabled={primaryActionDisabled}
      onReset={handleRetry}
    >
      <div className="space-y-6">
        {/* Consistent Step Page Title & Description across every step */}
        <div className="border-b border-slate-200 pb-3">
          <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight leading-snug">
            {currentStepMeta.title}
          </h2>
          <p className="text-[13px] text-slate-500 mt-1">
            {currentStepMeta.description}
          </p>
        </div>

        {/* STEP 1: FORM */}
        {activeStep === 1 && (
          <div className="space-y-6">
            {/* Running job banner on Step 1 (reconnected from localStorage) */}
            {runningJobBanner && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                  <span className="text-xs font-semibold text-blue-950">
                    A job is still running
                  </span>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => goToStep(4)}
                >
                  View progress
                </Button>
              </div>
            )}

            {/* Last completed/failed job link */}
            {!runningJobBanner && lastJobLink && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (lastJobLink.jobId) {
                      setActiveJobId(lastJobLink.jobId);
                    }
                    goToStep(4);
                  }}
                  className="text-[13px] text-slate-500 hover:text-blue-600 transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>
                    Last job: {lastJobLink.submitted} of {lastJobLink.total} submitted
                  </span>
                  <span className="text-blue-600 font-medium hover:underline">— View</span>
                </button>
              </div>
            )}

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
                  formKey={currentFormKey || data.formKey}
                  onContinue={() => goToStep(2)}
                  onUseDifferentForm={handleRetry}
                  showContinue={true}
                />
              </div>
            )}
          </div>
        )}

        {/* STEP 2: CONFIGURE (Main column vertically stacked: AUDIENCE, SETTINGS, QUESTIONS) */}
        {activeStep === 2 && data && (
          <div className="space-y-6">
            {/* 1. AUDIENCE card ("What is this form about?") */}
            <AudienceCard
              audienceMode={settings.audienceMode}
              scenario={settings.scenario}
              onAudienceModeChange={(m) => handleAudienceChange(m, undefined)}
              onScenarioChange={(s) => handleAudienceChange(undefined, s)}
              detectionInfo={prewarmInfo}
            />

            {/* 2. SETTINGS card ("Generation settings") */}
            <GenerationSettingsCard
              formId={data.formId}
              settings={settings}
              onMixChange={setMix}
              onCountChange={setCount}
              onSkipRateChange={setOptionalSkipRate}
              onAddPool={addPool}
              onRemovePool={removePool}
              onLoadTemplate={handleLoadTemplate}
              delay={delay}
              onDelayChange={setDelay}
            />

            {/* 3. QUESTIONS card */}
            <QuestionList
              questions={data.questions}
              overrides={settings.perQuestion}
              onOverrideChange={setQuestionOverride}
              pools={settings.pools}
              unsupported={data.unsupported}
            />

            {/* Step 2 Bottom Footer Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-200">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleRetry}
              >
                Use a different form
              </Button>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {validationError && (
                  <span className="text-xs text-rose-600 font-medium">
                    {validationError}
                  </span>
                )}

                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleRunPreview}
                  loading={previewLoading}
                  disabled={isStep2Disabled}
                  icon={ArrowRight}
                >
                  Continue to review
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: REVIEW (Dry Run) */}
        {activeStep === 3 && data && (
          <div className="space-y-6">
            {!previewResult && !previewLoading && !previewError ? (
              <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
                <EmptyState
                  title="No preview generated yet"
                  description="Synthesize 5 sample answers to verify field formatting, tone balance, and realism before submission."
                  action={
                    <Button variant="primary" size="md" onClick={handleRunPreview} icon={Sparkles}>
                      Generate Preview Sample
                    </Button>
                  }
                />
              </div>
            ) : (
              <DryRunTable
                responses={previewResult?.responses || []}
                questions={data.questions}
                metadata={previewResult?.metadata}
                detectionInfo={prewarmInfo}
                onRegenerate={handleRunPreview}
                onBack={() => goToStep(2)}
                onContinue={handleSkipToRun}
                loading={previewLoading}
                error={previewError}
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
                onClick={handleSkipToRun}
                disabled={previewLoading}
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
                onBackToConfigure={() => goToStep(2)}
                onRunAgain={() => {
                  handleClearActiveJob();
                  setTimeout(() => handleStartJob(), 100);
                }}
                actionLoading={actionLoading}
                isWaking={jobLoading && !job}
              />
            ) : (
              <div className="space-y-6">
                <StartJobPanel
                  formUrl={submittedUrl}
                  formTitle={data?.title}
                  count={settings.count}
                  onCountChange={setCount}
                  settings={settings}
                  delay={delay}
                  hasDryRun={Boolean(previewResult)}
                  onStartJob={handleStartJob}
                  onNavigateToStep={goToStep}
                  loading={startJobLoading}
                  error={startJobError}
                />

                <div className="flex items-center justify-start pt-2 border-t border-slate-200">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
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
