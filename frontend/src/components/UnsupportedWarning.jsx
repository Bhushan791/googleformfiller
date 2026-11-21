/**
 * Warning box shown when the parsed form has unsupported question types.
 */
export default function UnsupportedWarning({ items }) {
  if (!items?.length) return null;

  return (
    <div className="w-full max-w-xl rounded-lg border border-yellow-300 bg-yellow-50 p-4">
      <p className="text-sm font-medium text-yellow-800">
        ⚠ {items.length} unsupported question{items.length !== 1 ? "s" : ""} skipped
      </p>
      <ul className="mt-2 space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-yellow-700">
            <span className="font-medium">{item.title || "Untitled"}</span>
            {" — "}
            {item.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

