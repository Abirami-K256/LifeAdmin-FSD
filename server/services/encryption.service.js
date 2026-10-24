const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Readable } = require('stream');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a strictly 32-byte buffer from the configured ENCRYPTION_KEY.
 * Handles 64-character hex strings or arbitrary secret strings using sha256.
 */
const getKeyBuffer = () => {
  const secret = process.env.ENCRYPTION_KEY || 'default_32_bytes_secret_key_lifeadmin_app!';
  if (typeof secret === 'string' && /^[0-9a-fA-F]{64}$/.test(secret)) {
    return Buffer.from(secret, 'hex');
  }
  return crypto.createHash('sha256').update(secret).digest();
};

/**
 * Encrypts a Buffer using AES-256-GCM.
 * Prepends IV and AuthTag: [IV (16B)][AuthTag (16B)][Ciphertext]
 */
const encryptBuffer = (sourceBuffer) => {
  const key = getKeyBuffer();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(sourceBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]);
};

/**
 * Decrypts an AES-256-GCM Buffer: [IV (16B)][AuthTag (16B)][Ciphertext]
 */
const decryptBuffer = (combinedBuffer) => {
  if (combinedBuffer.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Encrypted buffer is corrupted or invalid.');
  }

  const iv = combinedBuffer.subarray(0, IV_LENGTH);
  const authTag = combinedBuffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combinedBuffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const key = getKeyBuffer();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
};

/**
 * Helper to obtain the active GridFS bucket from Mongoose.
 */
const getGridFSBucket = () => {
  if (!mongoose.connection || !mongoose.connection.db) {
    throw new Error('MongoDB is not connected. Cannot access GridFS bucket.');
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'encrypted_files',
  });
};

/**
 * Encrypts a plain buffer with AES-256-GCM and stores it in MongoDB GridFS.
 * Returns the GridFS file ObjectId.
 */
const saveEncryptedToGridFS = async (plainBuffer, filename, metadata = {}) => {
  const encryptedBuffer = encryptBuffer(plainBuffer);
  const bucket = getGridFSBucket();

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: 'application/octet-stream',
      metadata,
    });

    uploadStream.on('finish', () => resolve(uploadStream.id));
    uploadStream.on('error', reject);

    const readable = Readable.from(encryptedBuffer);
    readable.pipe(uploadStream);
  });
};

/**
 * Reads encrypted bytes from GridFS by ID and decrypts them on the fly.
 */
const readAndDecryptFromGridFS = async (fileId) => {
  const bucket = getGridFSBucket();
  const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;

  const encryptedBuffer = await new Promise((resolve, reject) => {
    const downloadStream = bucket.openDownloadStream(objectId);
    const chunks = [];
    downloadStream.on('data', (chunk) => chunks.push(chunk));
    downloadStream.on('error', reject);
    downloadStream.on('end', () => resolve(Buffer.concat(chunks)));
  });

  return decryptBuffer(encryptedBuffer);
};

/**
 * Deletes a file from GridFS by ID.
 */
const deleteFromGridFS = async (fileId) => {
  if (!fileId) return;
  try {
    const bucket = getGridFSBucket();
    const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
    await bucket.delete(objectId);
  } catch (err) {
    console.warn(`[GridFS] Could not delete file ${fileId}:`, err.message);
  }
};

/**
 * Legacy disk encryption helper (kept for fallback / local tests)
 */
const encryptAndSave = async (sourceBuffer, destinationPath) => {
  const combined = encryptBuffer(sourceBuffer);
  const dir = path.dirname(destinationPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  await fs.promises.writeFile(destinationPath, combined);
  return destinationPath;
};

/**
 * Legacy disk decryption helper
 */
const readAndDecrypt = async (encryptedFilePath) => {
  const combined = await fs.promises.readFile(encryptedFilePath);
  return decryptBuffer(combined);
};

module.exports = {
  getKeyBuffer,
  encryptBuffer,
  decryptBuffer,
  saveEncryptedToGridFS,
  readAndDecryptFromGridFS,
  deleteFromGridFS,
  encryptAndSave,
  readAndDecrypt,
};
