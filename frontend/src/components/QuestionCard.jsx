import QuestionOverridePanel from './QuestionOverridePanel';

const TYPE_COLORS = {
  short_text: 'bg-blue-100 text-blue-800',
  paragraph: 'bg-blue-100 text-blue-800',
  multiple_choice: 'bg-purple-100 text-purple-800',
  checkboxes: 'bg-purple-100 text-purple-800',
  dropdown: 'bg-teal-100 text-teal-800',
  linear_scale: 'bg-amber-100 text-amber-800',
  date: 'bg-pink-100 text-pink-800',
  time: 'bg-pink-100 text-pink-800',
};

const TYPE_LABELS = {
  short_text: 'Short text',
  paragraph: 'Paragraph',
  multiple_choice: 'Multiple choice',
  checkboxes: 'Checkboxes',
  dropdown: 'Dropdown',
  linear_scale: 'Linear scale',
  date: 'Date',
  time: 'Time',
};

/**
 * Renders a single question as a numbered card with optional override controls.
 */
export default function QuestionCard({
  question,
  index,
  override,
  onOverrideChange,
  pools,
}) {
  const { title, type, required, helpText, options, scaleRange } = question;
  const colorClass = TYPE_COLORS[type] ?? 'bg-gray-100 text-gray-800';
  const typeLabel = TYPE_LABELS[type] ?? type;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {/* Header: number + title */}
      <div className="flex items-start gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 break-words">{title}</p>

          {/* Badges */}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
              {typeLabel}
            </span>
            {required && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                Required
              </span>
            )}
          </div>

          {/* Help text */}
          {helpText && <p className="mt-2 text-xs text-gray-500">{helpText}</p>}

          {/* Options (for mc, cb, dropdown) */}
          {options?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {options.map((opt) => (
                <span
                  key={opt}
                  className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-600"
                >
                  {opt}
                </span>
              ))}
            </div>
          )}

          {/* Scale range */}
          {scaleRange && (
            <p className="mt-2 text-xs text-gray-500">
              {scaleRange.min} to {scaleRange.max}
              {(scaleRange.minLabel || scaleRange.maxLabel) && (
                <span>
                  {' '}— {scaleRange.minLabel && <em>"{scaleRange.minLabel}"</em>}
                  {scaleRange.minLabel && scaleRange.maxLabel && ' to '}
                  {scaleRange.maxLabel && <em>"{scaleRange.maxLabel}"</em>}
                </span>
              )}
            </p>
          )}

          {/* Question customization panel */}
          {onOverrideChange && (
            <QuestionOverridePanel
              question={question}
              override={override}
              onChange={onOverrideChange}
              pools={pools}
            />
          )}
        </div>
      </div>
    </div>
  );
}
