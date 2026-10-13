import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import StatusBadge from '../components/StatusBadge';
import { formatCalendarDate } from '../utils/dateUtils';
import {
  Search,
  Filter,
  ArrowUpDown,
  Upload,
  FileText,
  Calendar,
  Download,
  Trash2,
  ExternalLink,
  Shield,
  Layers,
} from 'lucide-react';

const CATEGORIES = [
  'All',
  'Passport',
  'Driving Licence',
  'Insurance',
  'Vehicle RC',
  'Warranty',
  'Certificate',
  'Other',
];

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('expiryAsc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (selectedCategory !== 'All') params.category = selectedCategory;
      if (sortBy) params.sort = sortBy;

      const res = await api.get('/documents', { params });
      setDocuments(res.data.documents || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchDocuments();
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [search, selectedCategory, sortBy]);

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${title}"?`)) {
      return;
    }

    try {
      setDeletingId(id);
      await api.delete(`/documents/${id}`);
      setDocuments((prev) => prev.filter((d) => d._id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete document.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (id, originalFileName) => {
    try {
      const response = await api.get(`/documents/${id}/file?download=true`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', originalFileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to download decrypted file.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Document Vault
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Browse, search, decrypt, and manage your stored documents
          </p>
        </div>
        <Link
          to="/upload"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-md shadow-blue-500/20 transition-all self-start sm:self-auto"
        >
          <Upload className="w-4 h-4" />
          Upload New Document
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search Input */}
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title, policy/DL number, or scanned OCR text..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Sort Selector */}
          <div className="relative">
            <ArrowUpDown className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="expiryAsc">Expiring Soonest First</option>
              <option value="expiryDesc">Expiring Latest First</option>
              <option value="createdDesc">Recently Uploaded First</option>
              <option value="titleAsc">Title (A - Z)</option>
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar text-xs">
          <span className="text-slate-400 dark:text-slate-500 text-xs font-semibold mr-1 shrink-0">
            Category:
          </span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-sm">
          {error}
        </div>
      )}

      {/* Document Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <FileText className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              No documents found
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {search || selectedCategory !== 'All'
                ? 'Try adjusting your search query or category filter.'
                : 'Your document vault is currently empty. Upload your first document to start automated expiry tracking.'}
            </p>
          </div>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-md transition-all"
          >
            <Upload className="w-4 h-4" />
            Upload Document
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map((doc) => (
            <div
              key={doc._id}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header: Category & Status */}
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    <Layers className="w-3 h-3" />
                    {doc.category}
                  </span>
                  <StatusBadge daysUntilExpiry={doc.daysUntilExpiry} />
                </div>

                {/* Title */}
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white hover:text-blue-600 transition-colors line-clamp-1">
                    <Link to={`/documents/${doc._id}`}>{doc.title}</Link>
                  </h3>
                  {doc.documentNumber && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      No: {doc.documentNumber}
                    </p>
                  )}
                </div>

                {/* Dates Information */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <Calendar className="w-3.5 h-3.5" /> Expiry Date:
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatCalendarDate(doc.expiryDate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Uploaded:</span>
                    <span>{new Date(doc.createdAt).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Bottom Card Actions */}
              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                <Link
                  to={`/documents/${doc._id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Details
                </Link>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDownload(doc._id, doc.originalFileName)}
                    title="Download Decrypted File"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(doc._id, doc.title)}
                    disabled={deletingId === doc._id}
                    title="Delete Document"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
