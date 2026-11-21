import { useState } from 'react';
import { isValidGoogleFormUrl } from '../utils/validators';

export default function FormUrlInput({ onSubmit }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  const trimmed = url.trim();
  const isValid = isValidGoogleFormUrl(trimmed);
  const isEmpty = trimmed.length === 0;
  const disabled = isEmpty || !isValid;

  /** Validate on blur or change once touched. */
  const validate = (value) => {
    const v = value.trim();
    if (!v) {
      setError('Please enter a Google Forms URL.');
    } else if (!isValidGoogleFormUrl(v)) {
      setError('Invalid URL — must be a docs.google.com/forms/… or forms.gle/… link.');
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
    <form onSubmit={handleSubmit} className="w-full max-w-xl space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="https://docs.google.com/forms/d/..."
          className={`flex-1 rounded-lg border px-4 py-2.5 text-sm outline-none transition
            ${error && touched
              ? 'border-red-400 focus:ring-red-200'
              : 'border-gray-300 focus:ring-indigo-200'}
            focus:ring-2`}
        />
        <button
          type="submit"
          disabled={disabled}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white
                     hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors cursor-pointer"
        >
          Load Form
        </button>
      </div>

      {/* Inline error */}
      {error && touched && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-gray-400">
        Use this only with forms you own, for testing and demo data.
      </p>
    </form>
  );
}

