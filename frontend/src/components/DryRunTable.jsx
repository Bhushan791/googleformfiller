const SENTIMENT_BADGES = {
  positive: "bg-green-100 text-green-800 border-green-200",
  neutral: "bg-gray-100 text-gray-800 border-gray-200",
  negative: "bg-red-100 text-red-800 border-red-200",
};

export default function DryRunTable({
  responses = [],
  questions = [],
  metadata = {},
  onRegenerate,
  loading = false,
}) {
  if (!responses.length && !loading) return null;

  return (
    <div className="w-full max-w-4xl rounded-lg border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-gray-900">
              Preview Sample Responses (Dry Run)
            </h4>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
              Dry Run
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            5 sample responses generated using current settings. Nothing has been submitted to Google Forms.
          </p>
        </div>

        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={loading}
            className="self-start sm:self-auto rounded-lg bg-indigo-50 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors border border-indigo-200 cursor-pointer flex items-center gap-1.5"
          >
            {loading ? (
              <>
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                <span>Generating…</span>
              </>
            ) : (
              <>
                <span>↻</span>
                <span>Regenerate Sample</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Fallback template notice */}
      {metadata?.fallbackUsed && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
          <span className="font-bold text-amber-600">ℹ</span>
          <div>
            <span className="font-semibold">AI unavailable:</span> Generated using built-in realistic templates and heuristic rules. Configure <code className="bg-amber-100 px-1 py-0.5 rounded text-[11px]">ANTHROPIC_API_KEY</code> in backend for dynamic AI responses.
          </div>
        </div>
      )}

      {/* Responses table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
          <thead className="bg-gray-50 text-gray-600 font-semibold">
            <tr>
              <th scope="col" className="px-3 py-2.5 whitespace-nowrap w-12 text-center">
                #
              </th>
              <th scope="col" className="px-3 py-2.5 whitespace-nowrap w-24">
                Sentiment
              </th>
              {questions.map((q, idx) => (
                <th
                  key={q.entryId || idx}
                  scope="col"
                  className="px-3 py-2.5 whitespace-nowrap max-w-[200px] truncate"
                  title={q.title}
                >
                  {q.title || `Q${idx + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {responses.map((resp, rIdx) => {
              const badgeClass =
                SENTIMENT_BADGES[resp.sentiment] || SENTIMENT_BADGES.neutral;

              return (
                <tr key={resp.index ?? rIdx} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-3 py-2.5 text-center font-mono text-gray-400">
                    {rIdx + 1}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium border ${badgeClass}`}
                    >
                      {resp.sentiment}
                    </span>
                  </td>
                  {questions.map((q, qIdx) => {
                    const rawVal = resp.answers[q.entryId];
                    let displayVal = "—";
                    if (Array.isArray(rawVal)) {
                      displayVal = rawVal.join(", ");
                    } else if (rawVal !== undefined && rawVal !== null && rawVal !== "") {
                      displayVal = String(rawVal);
                    }

                    return (
                      <td
                        key={q.entryId || qIdx}
                        className="px-3 py-2.5 text-gray-700 max-w-[240px] truncate"
                        title={displayVal}
                      >
                        {displayVal}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

