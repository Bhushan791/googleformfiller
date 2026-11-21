import React, { useState, useEffect } from 'react';
import { isValidGoogleFormUrl } from '../utils/validators';
import Button from './ui/Button';
import Input from './ui/Input';
import { Card, CardContent } from './ui/Card';
import { Link2, Sliders, PlayCircle, Clock } from 'lucide-react';

export default function FormUrlInput({ onSubmit, loading = false }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);
  const [recentForms, setRecentForms] = useState([]);

  // Load recent forms from localStorage (last 5, only title + shortenedUrl + date)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('formbot_recent_forms');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentForms(parsed.slice(0, 5));
        }
      }
    } catch {
      setRecentForms([]);
    }
  }, []);

  const handleClearRecent = () => {
    try {
      localStorage.removeItem('formbot_recent_forms');
    } catch {
      // ignore
    }
    setRecentForms([]);
  };

  const trimmed = url.trim();
  const isValid = isValidGoogleFormUrl(trimmed);
  const isEmpty = trimmed.length === 0;
  const disabled = isEmpty || !isValid || loading;

  const validate = (value) => {
    const v = value.trim();
    if (!v) {
      setError('Please enter a Google Forms URL.');
    } else if (!isValidGoogleFormUrl(v)) {
      setError('Must be docs.google.com/forms/… or forms.gle/… link.');
    } else {
      setError('');
    }
  };

  const handleChange = (e) => {
    setUrl(e.target.value);
    if (touched) validate(e.target.value);
  };

  const handleBlur = () => {
    setTouched(true);
    validate(url);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (disabled) return;
    onSubmit(trimmed);
  };

  return (
    <div className="w-full space-y-6">
      {/* Brand Hero on Step 1 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center gap-4">
          <img
            src="/logo.png"
            alt="Autofillr"
            className="h-12 sm:h-14 w-auto object-contain shrink-0"
          />
          <div className="border-l border-slate-200 pl-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Form Automation Engine
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Inspect questions, simulate diverse personas, and submit verified test data at scale.
            </p>
          </div>
        </div>
      </div>

      {/* Input Card */}
      <Card>
        <CardContent className="p-5">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="form-url-input" className="block text-xs font-semibold text-slate-800 mb-1.5">
                Google Form URL
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  id="form-url-input"
                  type="text"
                  value={url}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="https://docs.google.com/forms/d/e/.../viewform or forms.gle/..."
                  error={Boolean(error && touched)}
                  disabled={loading}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={disabled}
                  loading={loading}
                  className="sm:w-auto w-full shrink-0"
                >
                  Load form
                </Button>
              </div>
            </div>

            {error && touched ? (
              <p className="text-xs text-rose-600 font-medium">{error}</p>
            ) : (
              <p className="text-xs text-slate-500">
                Supports docs.google.com and forms.gle links. Enter forms you own or have permission to test.
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Recent Forms (if any) */}
      {recentForms.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-[8px] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Recent forms</span>
            </div>
            <button
              type="button"
              onClick={handleClearRecent}
              className="text-[11px] text-slate-400 hover:text-slate-600 font-medium cursor-pointer transition-colors"
            >
              Clear
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {recentForms.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSubmit(item.url)}
                disabled={loading}
                className="w-full py-2 flex items-center justify-between text-left hover:bg-slate-50 px-2 -mx-2 rounded transition-colors group cursor-pointer disabled:opacity-50"
              >
                <div className="min-w-0 pr-3">
                  <p className="text-xs font-medium text-slate-800 truncate group-hover:text-blue-600">
                    {item.title}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono truncate">
                    {item.shortenedUrl || item.url}
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">
                  {item.date}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3-column How it Works row */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          How it works
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded-[8px] p-4 flex flex-col gap-1.5">
            <div className="w-7 h-7 rounded-[6px] bg-slate-100 flex items-center justify-center text-slate-600 mb-1">
              <Link2 className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <h5 className="text-xs font-semibold text-slate-900">1. Load form</h5>
            <p className="text-[11px] text-slate-500 leading-normal">
              Safely inspects question types, scales, choices, and entry IDs.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-[8px] p-4 flex flex-col gap-1.5">
            <div className="w-7 h-7 rounded-[6px] bg-slate-100 flex items-center justify-center text-slate-600 mb-1">
              <Sliders className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <h5 className="text-xs font-semibold text-slate-900">2. Configure tone</h5>
            <p className="text-[11px] text-slate-500 leading-normal">
              Set sentiment distribution, response volume, and per-question overrides.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-[8px] p-4 flex flex-col gap-1.5">
            <div className="w-7 h-7 rounded-[6px] bg-slate-100 flex items-center justify-center text-slate-600 mb-1">
              <PlayCircle className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <h5 className="text-xs font-semibold text-slate-900">3. Run</h5>
            <p className="text-[11px] text-slate-500 leading-normal">
              Execute paced submissions to your form with instant prewarmed answers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
