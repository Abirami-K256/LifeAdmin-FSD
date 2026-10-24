const sharp = require('sharp');
const pdfParse = require('pdf-parse');
const { createWorker } = require('tesseract.js');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Ensure language cache directory is in the OS temp folder
const TESSERACT_CACHE_DIR = path.join(os.tmpdir(), 'lifeadmin-tesseract-cache');
if (!fs.existsSync(TESSERACT_CACHE_DIR)) {
  try {
    fs.mkdirSync(TESSERACT_CACHE_DIR, { recursive: true });
  } catch (dirErr) {
    console.warn('[OCR] Failed to create cache directory in os.tmpdir():', dirErr.message);
  }
}

/**
 * Preprocesses an image buffer using sharp to enhance OCR accuracy:
 * - Resizes images to a maximum of 1600px width to stay within 512 MB of memory
 * - Converts to grayscale
 * - Normalizes contrast
 * - Sharpens text boundaries
 */
async function preprocessImage(imageBuffer) {
  try {
    if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
      return imageBuffer;
    }

    const metadata = await sharp(imageBuffer).metadata();
    let pipeline = sharp(imageBuffer);

    // Resize images to a maximum of 1600px width before OCR (memory constraint on Render free tier)
    if (metadata.width && metadata.width > 1600) {
      pipeline = pipeline.resize({ width: 1600, withoutEnlargement: true, fit: 'inside' });
    }

    const processedBuffer = await pipeline
      .grayscale() // Remove color noise
      .normalize() // Stretch contrast to full range
      .sharpen()   // Sharpen text boundaries
      .png()       // Output clean PNG
      .toBuffer();

    return processedBuffer;
  } catch (err) {
    console.warn('[Sharp] Image preprocessing warning (using original buffer):', err.message);
    return imageBuffer;
  }
}

/**
 * Extracts text from an uploaded file buffer (PDF or Image).
 * Fully wrapped with try/catch, 30s timeout, and resource cleanup.
 *
 * @param {Buffer} fileBuffer
 * @param {string} mimeType
 * @returns {Promise<string>} Extracted raw text or empty string on failure
 */
async function extractTextFromFile(fileBuffer, mimeType) {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    return '';
  }

  // 1. Try PDF parsing first for PDF files
  if (mimeType === 'application/pdf') {
    try {
      const pdfData = await pdfParse(fileBuffer);
      if (pdfData && pdfData.text && pdfData.text.trim().length > 20) {
        return pdfData.text.trim();
      }
    } catch (pdfErr) {
      console.warn('[PDF-Parse] Could not parse text directly from PDF:', pdfErr.message);
      // Fall through to OCR if image-based PDF or failed parse
    }
  }

  // 2. Preprocess with Sharp (enforces max 1600px width)
  let processedBuffer = fileBuffer;
  try {
    processedBuffer = await preprocessImage(fileBuffer);
  } catch (sharpErr) {
    console.warn('[Sharp] Preprocessing failed, proceeding with raw buffer:', sharpErr.message);
    processedBuffer = fileBuffer;
  }

  // 3. Tesseract.js OCR with dedicated cachePath in OS temp directory & timeout protection
  let worker = null;
  const OCR_TIMEOUT_MS = 30000; // 30-second timeout

  try {
    worker = await createWorker('eng', 1, {
      cachePath: TESSERACT_CACHE_DIR,
      logger: () => {}, // suppress noisy worker console logs
    });

    const recognizePromise = worker.recognize(processedBuffer);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('OCR recognition timed out after 30 seconds')), OCR_TIMEOUT_MS)
    );

    const { data } = await Promise.race([recognizePromise, timeoutPromise]);
    return data && data.text ? data.text.trim() : '';
  } catch (ocrErr) {
    console.error('[Tesseract] OCR recognition failed or timed out safely:', ocrErr.message);
    return ''; // Return empty string so server handles smoothly without crashing
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (termErr) {
        console.warn('[Tesseract] Worker termination warning:', termErr.message);
      }
    }
  }
}

module.exports = {
  extractTextFromFile,
  preprocessImage,
  TESSERACT_CACHE_DIR,
};
