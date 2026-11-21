import { useState, useCallback } from 'react';
import Header from './components/Header';
import AIBanner from './components/AIBanner';
import FormUrlInput from './components/FormUrlInput';
import FormSummary from './components/FormSummary';
import QuestionList from './components/QuestionList';
import QuestionSkeleton from './components/QuestionSkeleton';
import ErrorMessage from './components/ErrorMessage';
import UnsupportedWarning from './components/UnsupportedWarning';
import SentimentControls from './components/SentimentControls';
import ResponseCountInput from './components/ResponseCountInput';
import PoolUploader from './components/PoolUploader';
import DryRunButton from './components/DryRunButton';
import DryRunTable from './components/DryRunTable';
import StartJobPanel from './components/StartJobPanel';
import JobDashboard from './components/JobDashboard';
import TemplateManager from './components/TemplateManager';
import useParseForm from './hooks/useParseForm';
import useSettings from './hooks/useSettings';
import useJob from './hooks/useJob';
import { previewResponses } from './api/preview';
import { createJob } from './api/jobs';

export default function App() {
  const [submittedUrl, setSubmittedUrl] = useState(null);
  const { data, loading, error, parse, reset } = useParseForm();

  const {
    settings,
    setMix,
    setCount,
    setQuestionOverride,
    addPool,
    removePool,
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
  };

  const handleRunPreview = useCallback(async () => {
    if (!data?.questions?.length) return;
    setPreviewLoading(true);
    setPreviewError(null);

    try {
      const res = await previewResponses(data.questions, settings);
      setPreviewResult(res.data);
    } catch (err) {
      setPreviewError(
        err.response?.data?.error?.message ||
          'Failed to generate preview responses. Please try again.'
      );
    } finally {
      setPreviewLoading(false);
    }
  }, [data, settings]);

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
    } catch (err) {
      setStartJobError(
        err.response?.data?.error?.message ||
          err.message ||
          'Failed to start job.'
      );
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
  };

  const handleLoadTemplate = (template) => {
    if (template.settings) loadSettings(template.settings);
    if (template.count) setCount(template.count);
    if (template.delay) setDelay(template.delay);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Header />
      <AIBanner />

      <main className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 pt-16 pb-20">
        {/* Title + description */}
        <div className="text-center max-w-xl">
          <h2 className="mb-1 text-2xl font-bold tracking-tight">
            Generate Test Responses
          </h2>
          <p className="text-sm text-gray-500">
            Paste a Google Form link to auto-fill it with realistic demo data.
          </p>
        </div>

        {/* Active Job Dashboard (if job is active or was running) */}
        {activeJobId && (
          <div className="w-full flex flex-col items-center">
            <JobDashboard
              job={job}
              onPause={pauseJob}
              onResume={resumeJob}
              onCancel={cancelJob}
              onClear={handleClearActiveJob}
              actionLoading={actionLoading}
            />
          </div>
        )}

        {/* URL input — visible when no form is loaded and no active job */}
        {!data && !loading && !activeJobId && (
          <FormUrlInput onSubmit={handleSubmit} />
        )}

        {/* Loading skeleton while parsing form */}
        {loading && <QuestionSkeleton />}

        {/* Form parsing error */}
        {error && <ErrorMessage error={error} onRetry={handleRetry} />}

        {/* Form Loaded & Config Flow */}
        {data && (
          <div className="w-full flex flex-col items-center gap-6">
            {/* Form Title & Summary */}
            <FormSummary
              title={data.title}
              description={data.description}
              questionCount={data.questions?.length ?? 0}
              unsupportedCount={data.unsupported?.length ?? 0}
            />

            {data.unsupported?.length > 0 && (
              <UnsupportedWarning items={data.unsupported} />
            )}

            {/* Template Manager */}
            <TemplateManager
              formId={data.formId}
              currentSettings={settings}
              currentCount={settings.count}
              currentDelay={delay}
              onLoadTemplate={handleLoadTemplate}
            />

            {/* Generation Controls */}
            <div className="w-full max-w-xl space-y-4">
              <SentimentControls
                mix={settings.mix}
                onChange={setMix}
                totalCount={settings.count}
              />

              <ResponseCountInput
                count={settings.count}
                onChange={setCount}
              />

              <PoolUploader
                pools={settings.pools}
                onAddPool={addPool}
                onRemovePool={removePool}
              />
            </div>

            {/* Questions with inline customizations */}
            <QuestionList
              questions={data.questions}
              overrides={settings.perQuestion}
              onOverrideChange={setQuestionOverride}
              pools={settings.pools}
            />

            {/* Dry Run Button */}
            <div className="w-full max-w-xl flex flex-col items-center gap-2">
              <DryRunButton
                onClick={handleRunPreview}
                loading={previewLoading}
                disabled={!data.questions?.length}
              />

              {previewError && (
                <div className="w-full rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {previewError}
                </div>
              )}
            </div>

            {/* Dry Run Preview Table */}
            {previewResult && (
              <DryRunTable
                responses={previewResult.responses}
                questions={data.questions}
                metadata={previewResult.metadata}
                onRegenerate={handleRunPreview}
                loading={previewLoading}
              />
            )}

            {/* Live Submission Panel (only when not already running an active job) */}
            {!activeJobId && (
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
            )}

            {/* Navigation back */}
            <button
              onClick={handleRetry}
              className="mt-4 rounded-lg border border-gray-300 px-5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              ← Parse another form
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
