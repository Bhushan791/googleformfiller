import useHealth from '../hooks/useHealth';

const STATUS_CONFIG = {
  online: {
    label: 'Server online',
    dotClass: 'bg-green-500',
    textClass: 'text-green-700',
  },
  waking: {
    label: 'Waking up…',
    dotClass: 'bg-yellow-400 animate-pulse',
    textClass: 'text-yellow-700',
  },
  offline: {
    label: 'Server offline',
    dotClass: 'bg-red-500',
    textClass: 'text-red-700',
  },
};

export default function HealthBadge() {
  const { status, responseTime, lastChecked, checkNow } = useHealth();
  const { label, dotClass, textClass } = STATUS_CONFIG[status];

  const timeAgo = lastChecked
    ? lastChecked.toLocaleTimeString()
    : '—';

  return (
    <div className="flex items-center gap-3 text-sm select-none">
      {/* Dot + label */}
      <span className="flex items-center gap-1.5">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass}`} />
        <span className={`font-medium ${textClass}`}>{label}</span>
      </span>

      {/* Response time */}
      {responseTime !== null && (
        <span className="text-gray-400">{responseTime} ms</span>
      )}

      {/* Last checked */}
      <span className="hidden sm:inline text-gray-400">
        {timeAgo}
      </span>

      {/* Check now button */}
      <button
        onClick={checkNow}
        className="ml-1 rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 
                   transition-colors cursor-pointer border border-gray-200"
      >
        Check now
      </button>
    </div>
  );
}

