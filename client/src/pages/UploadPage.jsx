import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import ExpiryBadge from '../components/ExpiryBadge';
import { toDateInputValue } from '../utils/dateUtils';
import {
  UploadCloud,
  FileCheck2,
  AlertTriangle,
  FileText,
  CheckCircle,
  Eye,
  RefreshCw,
  Info,
  Calendar,
  Layers,
  Hash,
  ShieldAlert,
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

export default function UploadPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Upload & processing state
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  // Confirm form state
  const [stagedData, setStagedData] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    category: 'Other',
    documentNumber: '',
    expiryDate: '',
  });
  const [showOcrText, setShowOcrText] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Validate file
  const validateFile = (file) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowed.includes(file.type.toLowerCase())) {
      return 'Invalid file type. Only JPG, PNG, and PDF files are allowed.';
    }
    if (file.size > 10 * 1024 * 1024) {
      return 'File size exceeds limit. Maximum allowed size is 10 MB.';
    }
    return null;
  };

  // Handle file selection
  const handleFile = async (file) => {
    setError('');
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSelectedFile(file);
    await processUploadedFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  // Upload and perform OCR & Date detection on backend
  const processUploadedFile = async (file) => {
    setIsProcessing(true);
    setError('');

    const data = new FormData();
    data.append('file', file);

    try {
      const response = await api.post('/documents/process', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const resData = response.data.data;
      setStagedData(resData);

      const formattedDate = toDateInputValue(resData.suggestedExpiryDate);

      setFormData({
        title: resData.suggestedTitle || file.name,
        category: resData.suggestedCategory || 'Other',
        documentNumber: resData.suggestedDocNumber || '',
        expiryDate: formattedDate,
      });
    } catch (err) {
      setError(
        err.response?.data?.message || 'Failed to process document with OCR. Please try again.'
      );
      setSelectedFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirm and save document to vault
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.expiryDate) {
      setError('Please provide a document title and an expiry date.');
      return;
    }

    try {
      setIsSaving(true);
      setError('');

      await api.post('/documents', {
        tempFileId: stagedData.tempFileId,
        title: formData.title,
        category: formData.category,
        documentNumber: formData.documentNumber,
        expiryDate: formData.expiryDate,
        ocrText: stagedData.ocrText,
        ocrConfidence: stagedData.ocrConfidence,
        originalFileName: stagedData.originalFileName,
        mimeType: stagedData.mimeType,
      });

      navigate('/documents');
    } catch (err) {
      setError(
        err.response?.data?.message || 'Failed to save document. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setStagedData(null);
    setSelectedFile(null);
    setFormData({ title: '', category: 'Other', documentNumber: '', expiryDate: '' });
    setError('');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Upload & Auto-Scan Document
        </h1>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Upload Dropzone (shown when no staged data) */}
      {!stagedData && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
              : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            disabled={isProcessing}
          />

          {isProcessing ? (
            <div className="py-8 flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-base font-semibold text-slate-900">Extracting text...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
                <UploadCloud className="w-8 h-8" />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-800">
                  Drag and drop your document here, or <span className="text-blue-600 hover:underline">browse</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Supported formats: <strong>JPG, PNG, PDF</strong> (Max file size: 10 MB)
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Confirm-Before-Save Form */}
      {stagedData && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6 animate-fade-in">
          {/* Header with OCR Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Step 2 of 2: Review & Confirm
              </span>
              <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                Confirm Document Details
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <ExpiryBadge confidence={stagedData.ocrConfidence} />
            </div>
          </div>

          {/* Mandatory Verification Note */}
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-3 text-sm">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-bold">Please verify: OCR can make mistakes.</p>
              <p className="text-xs mt-0.5 text-amber-700">
                Confirm that the detected expiry date matches the physical date on your document so your email alerts fire accurately.
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Document Title */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Document Title *
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. My Indian Passport"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Category *
                </label>
                <div className="relative">
                  <Layers className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Expiry Date */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Expiry Date *
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    required
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>

              {/* Document Number */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Document / Policy / Registration Number
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={formData.documentNumber}
                    onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                    placeholder="e.g. MH12-20190045612"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* OCR Raw Text Viewer Accordion */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowOcrText(!showOcrText)}
                className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                {showOcrText ? 'Hide Extracted OCR Text' : 'View Extracted OCR Text'}
              </button>
              {showOcrText && (
                <div className="mt-2.5 p-4 rounded-xl bg-slate-100 text-xs font-mono text-slate-700 max-h-48 overflow-y-auto whitespace-pre-wrap border border-slate-200">
                  {stagedData.ocrText || 'No plain text extracted.'}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleReset}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel & Re-upload
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 disabled:opacity-60 transition-all"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving to Vault...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Confirm & Save Document</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
