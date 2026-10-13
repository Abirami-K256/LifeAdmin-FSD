const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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
 * Encrypts a Buffer using AES-256-GCM and writes to target path.
 * Prepend IV and AuthTag: [IV (16B)][AuthTag (16B)][Ciphertext]
 */
const encryptAndSave = async (sourceBuffer, destinationPath) => {
  const key = getKeyBuffer();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(sourceBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combine IV + AuthTag + Encrypted data
  const combined = Buffer.concat([iv, authTag, encrypted]);

  // Ensure destination folder exists
  const dir = path.dirname(destinationPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await fs.promises.writeFile(destinationPath, combined);
  return destinationPath;
};

/**
 * Reads an encrypted file from disk and decrypts it back to plain Buffer.
 */
const readAndDecrypt = async (encryptedFilePath) => {
  const combined = await fs.promises.readFile(encryptedFilePath);

  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Encrypted file format is corrupted or invalid.');
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const key = getKeyBuffer();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted;
};

module.exports = {
  encryptAndSave,
  readAndDecrypt,
};
