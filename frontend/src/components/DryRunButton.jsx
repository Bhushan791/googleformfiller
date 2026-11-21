export default function DryRunButton({ onClick, loading, disabled }) {
  return (
    <div className="w-full flex justify-center py-2">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-2"
      >
        {loading ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <span>Generating Preview…</span>
          </>
        ) : (
          <>
            <span>⚡</span>
            <span>Generate Preview Responses (Dry Run)</span>
          </>
        )}
      </button>
    </div>
  );
}

