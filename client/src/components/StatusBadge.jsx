import React from 'react';

export default function StatusBadge({ daysUntilExpiry }) {
  if (daysUntilExpiry === null || daysUntilExpiry === undefined) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
        Unknown
      </span>
    );
  }

  if (daysUntilExpiry < 0) {
    const expiredDays = Math.abs(daysUntilExpiry);
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
        <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-rose-500"></span>
        Expired {expiredDays === 1 ? 'yesterday' : `${expiredDays} days ago`}
      </span>
    );
  }

  if (daysUntilExpiry <= 30) {
    const timeLabel =
      daysUntilExpiry === 0
        ? 'today!'
        : daysUntilExpiry === 1
        ? 'tomorrow (1d)'
        : `in ${daysUntilExpiry}d`;

    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
        <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-amber-500 animate-pulse"></span>
        Expiring {timeLabel}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
      <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-emerald-500"></span>
      Safe ({daysUntilExpiry}d left)
    </span>
  );
}
