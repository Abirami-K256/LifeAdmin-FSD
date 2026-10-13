import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { formatCalendarDate } from '../utils/dateUtils';
import {
  FileText,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Upload,
  ArrowRight,
  FolderOpen,
  Calendar,
  Layers,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [urgentDocs, setUrgentDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, docsRes] = await Promise.all([
        api.get('/documents/stats'),
        api.get('/documents?sort=expiryAsc'),
      ]);

      setStats(statsRes.data.stats);
      // Filter documents that are expired or expiring soon (<= 30 days)
      const urgent = docsRes.data.documents.filter(
        (d) => d.daysUntilExpiry !== null && d.daysUntilExpiry <= 30
      );
      setUrgentDocs(urgent.slice(0, 5));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading your document insights...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-blue-500/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Hello, {user?.name || 'Explorer'}! 👋
          </h1>
          <p className="text-blue-100 text-sm sm:text-base mt-1 max-w-xl">
            LifeAdmin keeps your sensitive identity and insurance papers securely encrypted and sends timely alerts before they expire.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-blue-700 font-semibold text-sm hover:bg-blue-50 shadow-md transition-all shrink-0"
          >
            <Upload className="w-4 h-4" />
            Upload Document
          </Link>
          <Link
            to="/documents"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-medium text-sm transition-all shrink-0"
          >
            <FolderOpen className="w-4 h-4" />
            All Files
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-sm">
          {error}
        </div>
      )}

      {/* 4 Primary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Documents */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Documents
            </span>
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {stats?.total || 0}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">files encrypted</span>
          </div>
        </div>

        {/* Safe Documents */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Safe & Valid
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {stats?.safe || 0}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">&gt; 30 days left</span>
          </div>
        </div>

        {/* Expiring Within 30 Days */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-amber-200 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/10 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Expiring Soon
            </span>
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600 dark:text-amber-400">
              {stats?.expiringSoon || 0}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">within 30 days</span>
          </div>
        </div>

        {/* Expired Documents */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-rose-200 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Expired
            </span>
            <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <AlertOctagon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-600 dark:text-rose-400">
              {stats?.expired || 0}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">needs renewal</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Urgent Attention List & Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Urgent Expiry List (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Urgent Action Required
              </h2>
            </div>
            <Link
              to="/documents"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              View all ({stats?.total || 0}) <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {urgentDocs.length === 0 ? (
            <div className="py-12 text-center">
              <div className="inline-flex p-3 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">All caught up!</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                You have no expired documents or renewals due in the next 30 days.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60 mt-2">
              {urgentDocs.map((doc) => (
                <div key={doc._id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white hover:text-blue-600 transition-colors">
                        <Link to={`/documents/${doc._id}`}>{doc.title}</Link>
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {doc.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Expiry: {formatCalendarDate(doc.expiryDate)}
                      </span>
                      {doc.documentNumber && (
                        <span>• No: {doc.documentNumber}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge daysUntilExpiry={doc.daysUntilExpiry} />
                    <Link
                      to={`/documents/${doc._id}`}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-700 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category Breakdown (1 col) */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-700">
            <Layers className="w-5 h-5 text-indigo-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Documents by Category
            </h2>
          </div>

          {!stats?.byCategory || stats.byCategory.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              No documents categorized yet.
            </div>
          ) : (
            <div className="space-y-3.5">
              {stats.byCategory.map((item) => {
                const percentage = stats.total > 0 ? Math.round((item.count / stats.total) * 100) : 0;
                return (
                  <div key={item.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-slate-700 dark:text-slate-300">{item.category}</span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {item.count} ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
            <Link
              to="/upload"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Add Another Document
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
