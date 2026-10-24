const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Document = require('../models/Document');
const ocrService = require('../services/ocr.service');
const dateDetector = require('../services/dateDetector.service');
const { detectCategory, extractDocumentNumber } = require('../utils/categoryKeywords');
const {
  saveEncryptedToGridFS,
  readAndDecryptFromGridFS,
  deleteFromGridFS,
  readAndDecrypt,
} = require('../services/encryption.service');

/**
 * Parses any incoming date string (YYYY-MM-DD or ISO) into a Date pinned to UTC 12:00:00 (noon).
 * This eliminates timezone shifts across different client and server locales.
 */
function parseCalendarDateToUtcNoon(dateInput) {
  if (!dateInput) return null;
  if (typeof dateInput === 'string') {
    // Matches YYYY-MM-DD
    const ymd = dateInput.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (ymd) {
      const year = parseInt(ymd[1], 10);
      const month = parseInt(ymd[2], 10) - 1;
      const day = parseInt(ymd[3], 10);
      return new Date(Date.UTC(year, month, day, 12, 0, 0));
    }
    // Matches DD/MM/YYYY
    const dmy = dateInput.trim().match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (dmy) {
      const day = parseInt(dmy[1], 10);
      const month = parseInt(dmy[2], 10) - 1;
      const year = parseInt(dmy[3], 10);
      return new Date(Date.UTC(year, month, day, 12, 0, 0));
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
}

// POST /api/documents/process
// Uploads file to memory, performs OCR & Date detection, encrypts & stores in MongoDB GridFS
exports.processDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please select a JPG, PNG, or PDF file.',
      });
    }

    const { buffer, originalname, mimetype } = req.file;

    // 1. Run OCR extraction
    let ocrText = '';
    try {
      ocrText = await ocrService.extractTextFromFile(buffer, mimetype);
    } catch (ocrErr) {
      console.warn('[Process] OCR parsing failed or image unreadable:', ocrErr.message);
      ocrText = '';
    }

    // 2. Detect category and document number
    const guessedCategory = detectCategory(ocrText);
    const guessedDocNumber = extractDocumentNumber(ocrText, guessedCategory);

    // 3. Detect expiry date
    const dateDetectionResult = dateDetector.detectExpiryDate(ocrText);

    // 4. Encrypt file with AES-256-GCM and store in MongoDB GridFS (no local disk dependency)
    const gridFsFileId = await saveEncryptedToGridFS(buffer, originalname, {
      mimeType: mimetype,
      originalName: originalname,
      uploadedBy: req.user._id,
    });

    // Formulate suggested title from filename or category
    const safeExt = path.extname(originalname);
    const cleanBaseName = path.basename(originalname, safeExt).replace(/[_-]+/g, ' ').trim();
    const suggestedTitle = cleanBaseName.length > 2 ? cleanBaseName : `${guessedCategory} Document`;

    res.status(200).json({
      success: true,
      message: 'File processed and encrypted successfully in GridFS. Please confirm document details.',
      data: {
        tempFileId: gridFsFileId.toString(),
        originalFileName: originalname,
        mimeType: mimetype,
        ocrText,
        suggestedTitle,
        suggestedCategory: guessedCategory,
        suggestedDocNumber: guessedDocNumber,
        suggestedExpiryDate: dateDetectionResult.expiryDate,
        ocrConfidence: dateDetectionResult.confidence,
        matchedKeyword: dateDetectionResult.matchedKeyword,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Confirms and saves document to database
exports.createDocument = async (req, res, next) => {
  try {
    const {
      tempFileId,
      title,
      category,
      documentNumber,
      expiryDate,
      ocrText,
      ocrConfidence,
      originalFileName,
      mimeType,
    } = req.body;

    if (!tempFileId || !title || !expiryDate) {
      return res.status(400).json({
        success: false,
        message: 'Title, expiry date, and uploaded file are required.',
      });
    }

    const parsedExpiry = parseCalendarDateToUtcNoon(expiryDate);
    if (!parsedExpiry) {
      return res.status(400).json({
        success: false,
        message: 'Invalid expiry date format.',
      });
    }

    const gridFsObjectId = mongoose.Types.ObjectId.isValid(tempFileId)
      ? new mongoose.Types.ObjectId(tempFileId)
      : null;

    const doc = await Document.create({
      userId: req.user._id,
      title: title.trim(),
      category: category || 'Other',
      documentNumber: documentNumber ? documentNumber.trim() : '',
      expiryDate: parsedExpiry,
      gridFsFileId: gridFsObjectId,
      encryptedFilePath: tempFileId.toString(),
      originalFileName: originalFileName || 'document',
      mimeType: mimeType || 'application/octet-stream',
      ocrText: ocrText || '',
      ocrConfidence: ocrConfidence || 'manual',
    });

    res.status(201).json({
      success: true,
      message: 'Document saved successfully.',
      document: doc,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/documents
// List documents for authenticated user with search, filter, and sorting
exports.getDocuments = async (req, res, next) => {
  try {
    const { search, category, sort } = req.query;

    const filter = { userId: req.user._id };

    if (category && category !== 'All') {
      filter.category = category;
    }

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
        { documentNumber: { $regex: q, $options: 'i' } },
        { ocrText: { $regex: q, $options: 'i' } },
      ];
    }

    let sortOption = { expiryDate: 1 }; // Default: soonest expiring first
    if (sort === 'expiryDesc') {
      sortOption = { expiryDate: -1 };
    } else if (sort === 'createdDesc') {
      sortOption = { createdAt: -1 };
    } else if (sort === 'titleAsc') {
      sortOption = { title: 1 };
    }

    const documents = await Document.find(filter).sort(sortOption);

    res.status(200).json({
      success: true,
      count: documents.length,
      documents,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/documents/stats
// Aggregates dashboard statistics
exports.getDocumentStats = async (req, res, next) => {
  try {
    const documents = await Document.find({ userId: req.user._id });

    let expiredCount = 0;
    let expiringSoonCount = 0;
    let safeCount = 0;

    const categoryCounts = {};

    documents.forEach((doc) => {
      // Category count
      categoryCounts[doc.category] = (categoryCounts[doc.category] || 0) + 1;

      // Status count directly from virtual daysUntilExpiry
      const diffDays = doc.daysUntilExpiry;
      if (diffDays === null || diffDays === undefined) {
        return;
      }

      if (diffDays < 0) {
        expiredCount += 1;
      } else if (diffDays <= 30) {
        expiringSoonCount += 1;
      } else {
        safeCount += 1;
      }
    });

    const byCategory = Object.keys(categoryCounts).map((cat) => ({
      category: cat,
      count: categoryCounts[cat],
    }));

    res.status(200).json({
      success: true,
      stats: {
        total: documents.length,
        expiringSoon: expiringSoonCount,
        expired: expiredCount,
        safe: safeCount,
        byCategory,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/documents/:id
// Get single document detail
exports.getDocumentById = async (req, res, next) => {
  try {
    const doc = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'Document not found or unauthorized.',
      });
    }

    res.status(200).json({
      success: true,
      document: doc,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/documents/:id/file
// Decrypts file from GridFS on the fly and streams to user
exports.getDocumentFile = async (req, res, next) => {
  try {
    const doc = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'Document not found or unauthorized.',
      });
    }

    let decryptedBuffer;

    if (doc.gridFsFileId) {
      // Primary: Decrypt directly from MongoDB GridFS
      decryptedBuffer = await readAndDecryptFromGridFS(doc.gridFsFileId);
    } else if (doc.encryptedFilePath && mongoose.Types.ObjectId.isValid(doc.encryptedFilePath)) {
      decryptedBuffer = await readAndDecryptFromGridFS(doc.encryptedFilePath);
    } else if (doc.encryptedFilePath && fs.existsSync(doc.encryptedFilePath)) {
      // Fallback for legacy local disk files
      decryptedBuffer = await readAndDecrypt(doc.encryptedFilePath);
    } else {
      return res.status(404).json({
        success: false,
        message: 'Encrypted document file could not be found.',
      });
    }

    const isDownload = req.query.download === 'true';
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader(
      'Content-Disposition',
      `${isDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(doc.originalFileName)}"`
    );
    res.send(decryptedBuffer);
  } catch (err) {
    next(err);
  }
};

// PUT /api/documents/:id
// Update document metadata
exports.updateDocument = async (req, res, next) => {
  try {
    const { title, category, documentNumber, expiryDate } = req.body;

    const doc = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'Document not found or unauthorized.',
      });
    }

    if (title) doc.title = title.trim();
    if (category) doc.category = category;
    if (documentNumber !== undefined) doc.documentNumber = documentNumber.trim();
    if (expiryDate) {
      const parsed = parseCalendarDateToUtcNoon(expiryDate);
      if (!parsed) {
        return res.status(400).json({ success: false, message: 'Invalid expiry date format.' });
      }
      doc.expiryDate = parsed;
    }

    await doc.save();

    res.status(200).json({
      success: true,
      message: 'Document updated successfully.',
      document: doc,
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/documents/:id
// Deletes document and its encrypted file in GridFS
exports.deleteDocument = async (req, res, next) => {
  try {
    const doc = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'Document not found or unauthorized.',
      });
    }

    // Delete encrypted file from GridFS
    const gridId = doc.gridFsFileId || (mongoose.Types.ObjectId.isValid(doc.encryptedFilePath) ? doc.encryptedFilePath : null);
    if (gridId) {
      await deleteFromGridFS(gridId);
    }

    // Also remove from disk if legacy file exists
    if (doc.encryptedFilePath && fs.existsSync(doc.encryptedFilePath)) {
      try {
        await fs.promises.unlink(doc.encryptedFilePath);
      } catch (fileErr) {
        console.warn('[Delete] Failed to delete file on disk:', fileErr.message);
      }
    }

    await Document.deleteOne({ _id: doc._id });

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
};
