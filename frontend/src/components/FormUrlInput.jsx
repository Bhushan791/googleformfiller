import React, { useState } from 'react';
import { isValidGoogleFormUrl } from '../utils/validators';
import Button from './ui/Button';
import Input from './ui/Input';
import { Card, CardContent } from './ui/Card';
import { Link2, Sliders, PlayCircle } from 'lucide-react';

export default function FormUrlInput({ onSubmit, loading = false }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

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

      {/* 3-item How it Works row */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Workflow
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded-[8px] p-4 flex flex-col gap-1.5">
            <div className="w-7 h-7 rounded-[6px] bg-slate-100 flex items-center justify-center text-slate-600 mb-1">
              <Link2 className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <h5 className="text-xs font-semibold text-slate-900">1. Connect & Parse</h5>
            <p className="text-[11px] text-slate-500 leading-normal">
              Safely extracts questions, scales, choices, and entry IDs without logins.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-[8px] p-4 flex flex-col gap-1.5">
            <div className="w-7 h-7 rounded-[6px] bg-slate-100 flex items-center justify-center text-slate-600 mb-1">
              <Sliders className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <h5 className="text-xs font-semibold text-slate-900">2. Configure Logic</h5>
            <p className="text-[11px] text-slate-500 leading-normal">
              Tune sentiment distributions, response counts, mock data pools, and overrides.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-[8px] p-4 flex flex-col gap-1.5">
            <div className="w-7 h-7 rounded-[6px] bg-slate-100 flex items-center justify-center text-slate-600 mb-1">
              <PlayCircle className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <h5 className="text-xs font-semibold text-slate-900">3. Dry Run & Submit</h5>
            <p className="text-[11px] text-slate-500 leading-normal">
              Preview prewarmed realistic responses instantly, then stream automated submissions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
