import { getExportCsvUrl } from '../api/jobs';

export default function ExportButton({ jobId, disabled = false, label = 'Export CSV' }) {
  if (!jobId) return null;

  const url = getExportCsvUrl(jobId);

  return (
    <a
      href={url}
      download={`job-${jobId}-results.csv`}
      className={`inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${
        disabled ? 'pointer-events-none opacity-50' : 'cursor-pointer'
      }`}
    >
      <svg
        className="h-4 w-4 text-gray-500"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
        />
      </svg>
      {label}
    </a>
  );
}

