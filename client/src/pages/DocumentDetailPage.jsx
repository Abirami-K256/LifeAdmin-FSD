import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import StatusBadge from '../components/StatusBadge';
import ExpiryBadge from '../components/ExpiryBadge';
import { formatCalendarDate, toDateInputValue } from '../utils/dateUtils';
import {
  ArrowLeft,
  Calendar,
  Download,
  Trash2,
  Edit2,
  Check,
  X,
  FileText,
  FileCheck,
  Layers,
  Eye,
} from 'lucide-react';

const CATEGORIES = [
  'Passport',
  'Driving Licence',
  'Insurance',
  'Vehicle RC',
  'Warranty',
  'Certificate',
  'Other',
];

export default function DocumentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Preview state
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    category: '',
    documentNumber: '',
    expiryDate: '',
  });
  const [saveLoading, setSaveLoading] = useState(false);

  const fetchDocument = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/documents/${id}`);
      const data = res.data.document;
      setDoc(data);

      setEditForm({
        title: data.title,
        category: data.category,
        documentNumber: data.documentNumber || '',
        expiryDate: toDateInputValue(data.expiryDate),
      });

      // Load decrypted preview
      loadDecryptedPreview(data._id);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load document.');
    } finally {
      setLoading(false);
    }
  };

  const loadDecryptedPreview = async (docId) => {
    try {
      setPreviewLoading(true);
      const res = await api.get(`/documents/${docId}/file`, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(res.data);
      setPreviewUrl(blobUrl);
    } catch (err) {
      console.warn('Failed to load file preview:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    fetchDocument();
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [id]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      setSaveLoading(true);
      const res = await api.put(`/documents/${id}`, editForm);
      setDoc(res.data.document);
      setIsEditing(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update document.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${doc.title}"? This cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/documents/${id}`);
      navigate('/documents');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete document.');
    }
  };

  const handleDownload = async () => {
    try {
      const response = await api.get(`/documents/${id}/file?download=true`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.originalFileName || 'document');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to download decrypted file.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-rose-600 font-semibold">{error || 'Document not found.'}</p>
        <Link to="/documents" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
          &larr; Return to Document Vault
        </Link>
      </div>
    );
  }

  const isPdf = doc.mimeType === 'application/pdf';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/documents"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Documents
        </Link>
      </div>

      {/* Main Details Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700">
                <Layers className="w-3.5 h-3.5" />
                {doc.category}
              </span>
              <StatusBadge daysUntilExpiry={doc.daysUntilExpiry} />
              <ExpiryBadge confidence={doc.ocrConfidence} />
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {doc.title}
            </h1>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              {isEditing ? 'Cancel Edit' : 'Edit Details'}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download Decrypted File
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </div>

        {/* Edit Form */}
        {isEditing && (
          <form onSubmit={handleUpdate} className="py-6 border-b border-slate-100 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900"
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Document Number</label>
                <input
                  type="text"
                  value={editForm.documentNumber}
                  onChange={(e) => setEditForm({ ...editForm, documentNumber: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Expiry Date</label>
                <input
                  type="date"
                  required
                  value={editForm.expiryDate}
                  onChange={(e) => setEditForm({ ...editForm, expiryDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-1.5 rounded-lg text-xs font-medium border border-slate-300 text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveLoading}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {saveLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}

        {/* Metadata info cards */}
        <div className="py-6 border-b border-slate-100 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 inline-block">
            <span className="text-slate-400 font-medium">Expiry Date</span>
            <p className="text-sm font-bold text-slate-900 mt-1">
              {formatCalendarDate(doc.expiryDate, 'long')}
            </p>
          </div>
        </div>

        {/* File Preview and Scanned Text Section */}
        <div className="pt-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Decrypted File Preview */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-600" />
              Decrypted Document Preview
            </h3>
            {previewLoading ? (
              <div className="h-72 flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-200">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : previewUrl ? (
              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center min-h-[350px] max-h-[500px]">
                {isPdf ? (
                  <iframe src={previewUrl} title="PDF Preview" className="w-full h-[450px] border-none" />
                ) : (
                  <img src={previewUrl} alt={doc.title} className="max-h-[450px] object-contain w-full" />
                )}
              </div>
            ) : (
              <div className="h-72 flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                Preview not available. You can download the file directly.
              </div>
            )}
          </div>

          {/* Extracted OCR Text */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              Extracted OCR Text
            </h3>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700 max-h-[450px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {doc.ocrText || 'No text extracted for this document.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
