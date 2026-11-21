import React from 'react';
import Alert from './ui/Alert';
import Button from './ui/Button';

const ERROR_MESSAGES = {
  INVALID_URL: "That doesn't look like a valid URL. Please check and try again.",
  HOST_NOT_ALLOWED: "Only Google Forms URLs are accepted (docs.google.com/forms or forms.gle).",
  FORM_NOT_FOUND: "We couldn't find that form. It may have been deleted or the URL is wrong.",
  LOGIN_REQUIRED: "This form requires sign-in, so it can't be filled automatically without authentication.",
  FORM_CLOSED: "This form is no longer accepting responses.",
  UNSUPPORTED_REQUIRED_QUESTION: "This form has a required question type we can't auto-fill (e.g. grid or file upload).",
  PARSE_FAILED: "We fetched the page but couldn't read the form structure. The form may be private or unusual.",
  FETCH_TIMEOUT: "The request to Google Forms timed out. Please try again.",
  VALIDATION_ERROR: "Invalid input. Please provide a valid Google Forms URL.",
  NETWORK_ERROR: "Could not reach the server. Please check your connection and try again.",
  CONSENT_PAGE: "Google returned a cookie consent redirect page that blocked parsing.",
};

/**
 * Displays a user-friendly error message with a "Try another link" ghost button.
 */
export default function ErrorMessage({ error, onRetry }) {
  const friendlyMessage =
    ERROR_MESSAGES[error?.errorCode] ?? error?.message ?? "Failed to load Google Form.";

  return (
    <div className="w-full space-y-3">
      <Alert
        variant="error"
        title="Could not load form"
      >
        <p className="mt-1 text-xs text-rose-700">{friendlyMessage}</p>
        {onRetry && (
          <div className="mt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="text-rose-700 hover:text-rose-800 hover:bg-rose-100/50 -ml-2"
            >
              Try another link
            </Button>
          </div>
        )}
      </Alert>
    </div>
  );
}
