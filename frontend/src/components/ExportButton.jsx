import React from 'react';
import { Download } from 'lucide-react';
import { getExportCsvUrl } from '../api/jobs';

export default function ExportButton({ jobId, disabled = false, label = 'Export CSV' }) {
  if (!jobId) return null;

  const url = getExportCsvUrl(jobId);

  return (
    <a
      href={url}
      download={`job-${jobId}-results.csv`}
      className={`inline-flex items-center justify-center gap-2 h-9 px-3.5 text-[13px] font-medium rounded-[6px] transition-colors select-none border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 ${
        disabled ? 'pointer-events-none opacity-50' : 'cursor-pointer'
      }`}
    >
      <Download className="w-4 h-4 shrink-0 text-slate-500" strokeWidth={1.75} />
      <span>{label}</span>
    </a>
  );
}
