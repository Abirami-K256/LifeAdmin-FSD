require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Document = require('../models/Document');
const { encryptAndSave } = require('../services/encryption.service');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

async function createSampleImage(title, category, docNumber, expiryStr) {
  const svg = `
    <svg width="700" height="420" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" rx="16" fill="url(#bgGrad)" stroke="#3b82f6" stroke-width="4"/>
      <rect x="30" y="30" width="640" height="60" rx="8" fill="#1e3a8a"/>
      <text x="50" y="70" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#ffffff">REPUBLIC OF INDIA • OFFICIAL DOCUMENT</text>
      <text x="50" y="140" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#93c5fd">${title.toUpperCase()}</text>
      <text x="50" y="180" font-family="Arial, sans-serif" font-size="16" fill="#cbd5e1">Category: ${category}</text>
      <text x="50" y="220" font-family="Arial, sans-serif" font-size="16" fill="#cbd5e1">Document No: ${docNumber}</text>
      <text x="50" y="260" font-family="Arial, sans-serif" font-size="16" fill="#cbd5e1">Date of Issue: 12/01/2020</text>
      <rect x="40" y="290" width="620" height="50" rx="6" fill="#334155"/>
      <text x="60" y="322" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#facc15">VALID UPTO / EXPIRY: ${expiryStr}</text>
      <text x="50" y="380" font-family="monospace" font-size="14" fill="#64748b">P&lt;IND&lt;&lt;SAMPLE&lt;&lt;DEMO&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;998811</text>
    </svg>
  `;

  return await sharp(Buffer.from(svg)).png().toBuffer();
}

async function seed() {
  console.log('[Seed] Connecting to database...');
  await connectDB();

  // Create or retrieve Demo User
  const demoEmail ='demo@lifeadmin.com';
  let user = await User.findOne({ email: demoEmail });
  if (!user) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Password123!', salt);
    user = await User.create({
      name: 'Hari Demo',
      email: demoEmail,
      passwordHash,
    });
    console.log(`[Seed] Created Demo User: ${demoEmail} (Password: Password123!)`);
  } else {
    console.log(`[Seed] Using existing Demo User: ${demoEmail}`);
  }

  // Clear existing sample documents for this user
  await Document.deleteMany({ userId: user._id });

  const now = new Date();

  // 1. Safe document (Indian Passport: expires in 4 years)
  const safeDate = new Date(now.getFullYear() + 4, 7, 15);
  const safeBuf = await createSampleImage('Republic of India Passport', 'Passport', 'Z9821453', '15/08/2030');
  const safeFileId = `sample_passport_${Date.now()}.png.enc`;
  await encryptAndSave(safeBuf, path.join(UPLOADS_DIR, safeFileId));
  await Document.create({
    userId: user._id,
    title: 'Indian Passport (10-Year)',
    category: 'Passport',
    documentNumber: 'Z9821453',
    expiryDate: safeDate,
    encryptedFilePath: path.join(UPLOADS_DIR, safeFileId),
    originalFileName: 'Indian_Passport.png',
    mimeType: 'image/png',
    ocrText: 'REPUBLIC OF INDIA PASSPORT NO: Z9821453 DATE OF EXPIRY: 15/08/2030',
    ocrConfidence: 'high',
  });

  // 2. Expiring soon (15 days: Driving Licence)
  const soonDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
  const soonStr = soonDate.toLocaleDateString('en-IN');
  const soonBuf = await createSampleImage('Motor Driving Licence', 'Driving Licence', 'MH12-20190045612', soonStr);
  const soonFileId = `sample_dl_${Date.now()}.png.enc`;
  await encryptAndSave(soonBuf, path.join(UPLOADS_DIR, soonFileId));
  await Document.create({
    userId: user._id,
    title: 'Maharashtra Driving Licence (LMV)',
    category: 'Driving Licence',
    documentNumber: 'MH12-20190045612',
    expiryDate: soonDate,
    encryptedFilePath: path.join(UPLOADS_DIR, soonFileId),
    originalFileName: 'Driving_Licence.png',
    mimeType: 'image/png',
    ocrText: `UNION OF INDIA DRIVING LICENCE LICENCE NO: MH12-20190045612 VALID UPTO: ${soonStr}`,
    ocrConfidence: 'high',
  });

  // 3. Expiring soon (4 days: Vehicle Insurance)
  const criticalDate = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
  const critStr = criticalDate.toLocaleDateString('en-IN');
  const critBuf = await createSampleImage('HDFC ERGO Car Insurance', 'Insurance', 'POL-7788991122', critStr);
  const critFileId = `sample_ins_${Date.now()}.png.enc`;
  await encryptAndSave(critBuf, path.join(UPLOADS_DIR, critFileId));
  await Document.create({
    userId: user._id,
    title: 'HDFC ERGO Comprehensive Motor Insurance',
    category: 'Insurance',
    documentNumber: 'POL-7788991122',
    expiryDate: criticalDate,
    encryptedFilePath: path.join(UPLOADS_DIR, critFileId),
    originalFileName: 'Motor_Insurance_Policy.png',
    mimeType: 'image/png',
    ocrText: `HDFC ERGO GENERAL INSURANCE POLICY NUMBER: POL-7788991122 PERIOD OF INSURANCE TO: ${critStr}`,
    ocrConfidence: 'high',
  });

  // 4. Expired document (10 days ago: Vehicle Pollution RC)
  const expiredDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  const expStr = expiredDate.toLocaleDateString('en-IN');
  const expBuf = await createSampleImage('Vehicle Registration Certificate', 'Vehicle RC', 'MH02CB4510', expStr);
  const expFileId = `sample_rc_${Date.now()}.png.enc`;
  await encryptAndSave(expBuf, path.join(UPLOADS_DIR, expFileId));
  await Document.create({
    userId: user._id,
    title: 'Car Registration Certificate & PUC',
    category: 'Vehicle RC',
    documentNumber: 'MH02CB4510',
    expiryDate: expiredDate,
    encryptedFilePath: path.join(UPLOADS_DIR, expFileId),
    originalFileName: 'Vehicle_RC_Certificate.png',
    mimeType: 'image/png',
    ocrText: `VAHAN REGISTRATION CERTIFICATE REGN NO: MH02CB4510 VALID TILL: ${expStr}`,
    ocrConfidence: 'high',
  });

  console.log('[Seed] Seed completed successfully with 4 realistic encrypted test documents!');
  console.log(`[Seed] Login with: ${demoEmail} / Password123!`);

  await disconnectDB();
  process.exit(0);
}

seed().catch((err) => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
