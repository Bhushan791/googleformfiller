/**
 * Displays form title, description, and question count after parsing.
 */
export default function FormSummary({ title, description, questionCount, unsupportedCount }) {
  return (
    <div className="w-full max-w-xl rounded-lg border border-indigo-200 bg-indigo-50 p-5">
      <h3 className="text-lg font-bold text-indigo-900">{title}</h3>

      {description && (
        <p className="mt-1 text-sm text-indigo-700">{description}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        <span className="rounded-full bg-indigo-100 px-3 py-1 font-medium text-indigo-800">
          {questionCount} question{questionCount !== 1 ? "s" : ""}
        </span>

        {unsupportedCount > 0 && (
          <span className="rounded-full bg-yellow-100 px-3 py-1 font-medium text-yellow-800">
            {unsupportedCount} unsupported
          </span>
        )}
      </div>
    </div>
  );
}

