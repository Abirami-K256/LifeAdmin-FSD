const sharp = require('sharp');
const pdfParse = require('pdf-parse');
const { createWorker } = require('tesseract.js');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Ensure language cache directory is outside the server watch path
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
 * - Upscales narrow images
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

    // If image is narrow, upscale for improved character recognition
    if (metadata.width && metadata.width < 1600) {
      pipeline = pipeline.resize({ width: 2000, withoutEnlargement: false, fit: 'inside' });
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
 * Fully wrapped with try/catch and resource cleanup so OCR failures cannot crash the server.
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

  // 2. Preprocess with Sharp
  let processedBuffer = fileBuffer;
  try {
    processedBuffer = await preprocessImage(fileBuffer);
  } catch (sharpErr) {
    console.warn('[Sharp] Preprocessing failed, proceeding with raw buffer:', sharpErr.message);
    processedBuffer = fileBuffer;
  }

  // 3. Tesseract.js OCR with dedicated cachePath outside project root
  let worker = null;
  try {
    worker = await createWorker('eng', 1, {
      cachePath: TESSERACT_CACHE_DIR,
      logger: () => {}, // suppress noisy worker console logs
    });

    const { data } = await worker.recognize(processedBuffer);
    return data && data.text ? data.text.trim() : '';
  } catch (ocrErr) {
    console.error('[Tesseract] OCR recognition failed safely:', ocrErr.message);
    return ''; // Return empty string so server handles smoothly
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
