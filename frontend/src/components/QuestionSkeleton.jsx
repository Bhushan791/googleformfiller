/**
 * Skeleton placeholder shown while the form is being parsed.
 */
export default function QuestionSkeleton() {
  const rows = Array.from({ length: 4 });

  return (
    <div className="w-full max-w-xl space-y-3 animate-pulse">
      {/* Summary skeleton */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="h-5 w-48 rounded bg-gray-200" />
        <div className="mt-2 h-3 w-72 rounded bg-gray-100" />
        <div className="mt-3 h-5 w-24 rounded-full bg-gray-100" />
      </div>

      {/* Question card skeletons */}
      {rows.map((_, i) => (
        <div key={i} className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-gray-200" />
              <div className="flex gap-1.5">
                <div className="h-5 w-20 rounded-full bg-gray-100" />
                <div className="h-5 w-16 rounded-full bg-gray-100" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

