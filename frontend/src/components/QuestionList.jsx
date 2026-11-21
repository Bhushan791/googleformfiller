import QuestionCard from './QuestionCard';

/**
 * Renders the full list of parsed questions with optional override panels.
 */
export default function QuestionList({
  questions,
  overrides = {},
  onOverrideChange,
  pools = {},
}) {
  if (!questions?.length) return null;

  return (
    <div className="w-full max-w-xl space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">Questions</h4>
        <span className="text-xs text-gray-400">
          {questions.length} question{questions.length !== 1 ? 's' : ''} parsed
        </span>
      </div>

      {questions.map((q, i) => {
        const qKey = q.id || q.entryId;
        return (
          <QuestionCard
            key={qKey ?? i}
            question={q}
            index={i}
            override={overrides[qKey]}
            onOverrideChange={
              onOverrideChange ? (ovr) => onOverrideChange(qKey, ovr) : undefined
            }
            pools={pools}
          />
        );
      })}
    </div>
  );
}
