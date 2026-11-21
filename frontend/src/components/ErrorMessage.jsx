const ERROR_MESSAGES = {
  INVALID_URL: "That doesn't look like a valid URL. Please check and try again.",
  HOST_NOT_ALLOWED: "Only Google Forms URLs are accepted (docs.google.com/forms or forms.gle).",
  FORM_NOT_FOUND: "We couldn't find that form. It may have been deleted or the URL is wrong.",
  LOGIN_REQUIRED: "This form requires sign-in, so it can't be filled automatically.",
  FORM_CLOSED: "This form is no longer accepting responses.",
  UNSUPPORTED_REQUIRED_QUESTION: "This form has a required question type we can't auto-fill (e.g. grid or file upload).",
  PARSE_FAILED: "We fetched the page but couldn't read the form data. The form may be private or structured unusually.",
  FETCH_TIMEOUT: "The request to Google Forms timed out. Please try again.",
  VALIDATION_ERROR: "Invalid input. Please provide a valid Google Forms URL.",
  NETWORK_ERROR: "Could not reach the server. Please check your connection and try again.",
};

/**
 * Displays a user-friendly error message with a "Try another link" button.
 */
export default function ErrorMessage({ error, onRetry }) {
  const friendlyMessage =
    ERROR_MESSAGES[error?.errorCode] ?? error?.message ?? "Something went wrong.";

  return (
    <div className="w-full max-w-xl rounded-lg border border-red-200 bg-red-50 p-5">
      <p className="text-sm font-medium text-red-800">⚠ Something went wrong</p>
      <p className="mt-1 text-sm text-red-700">{friendlyMessage}</p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-lg border border-red-300 bg-white px-4 py-1.5 text-xs 
                     font-medium text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
        >
          Try another link
        </button>
      )}
    </div>
  );
}

