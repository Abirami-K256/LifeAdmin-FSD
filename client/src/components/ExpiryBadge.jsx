import React from 'react';
import { Sparkles, AlertCircle, CheckCircle } from 'lucide-react';

export default function ExpiryBadge({ confidence }) {
  if (confidence === 'high') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        High Confidence OCR
      </span>
    );
  }

  if (confidence === 'medium') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
        <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        Medium Confidence OCR
      </span>
    );
  }

  if (confidence === 'low') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
        <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
        Low Confidence - Please Check
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
      Manual Entry
    </span>
  );
}
