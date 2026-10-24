const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
require('dotenv').config();
const bcrypt = require('bcryptjs');
const sharp = require('sharp');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Document = require('../models/Document');
const { saveEncryptedToGridFS, deleteFromGridFS } = require('../services/encryption.service');

// Prevent running seed script in production
if (process.env.NODE_ENV === 'production') {
  console.error('[Seed Fatal] Seed script is strictly disabled in production to protect real user data.');
  process.exit(1);
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
  const demoEmail = 'demo@lifeadmin.com';
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

  // Clear existing sample documents and their GridFS files for this user
  const existingDocs = await Document.find({ userId: user._id });
  for (const oldDoc of existingDocs) {
    if (oldDoc.gridFsFileId) {
      await deleteFromGridFS(oldDoc.gridFsFileId);
    }
  }
  await Document.deleteMany({ userId: user._id });

  const now = new Date();

  // 1. Safe document (Indian Passport: expires in 4 years)
  const safeDate = new Date(Date.UTC(now.getFullYear() + 4, 7, 15, 12, 0, 0));
  const safeBuf = await createSampleImage('Republic of India Passport', 'Passport', 'Z9821453', '15/08/2030');
  const safeGridId = await saveEncryptedToGridFS(safeBuf, 'Indian_Passport.png', { mimeType: 'image/png' });
  await Document.create({
    userId: user._id,
    title: 'Indian Passport (10-Year)',
    category: 'Passport',
    documentNumber: 'Z9821453',
    expiryDate: safeDate,
    gridFsFileId: safeGridId,
    encryptedFilePath: safeGridId.toString(),
    originalFileName: 'Indian_Passport.png',
    mimeType: 'image/png',
    ocrText: 'REPUBLIC OF INDIA PASSPORT NO: Z9821453 DATE OF EXPIRY: 15/08/2030',
    ocrConfidence: 'high',
  });

  // 2. Expiring soon (15 days: Driving Licence)
  const soonDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 15, 12, 0, 0));
  const soonStr = `${String(soonDate.getUTCDate()).padStart(2, '0')}/${String(soonDate.getUTCMonth() + 1).padStart(2, '0')}/${soonDate.getUTCFullYear()}`;
  const soonBuf = await createSampleImage('Motor Driving Licence', 'Driving Licence', 'MH12-20190045612', soonStr);
  const soonGridId = await saveEncryptedToGridFS(soonBuf, 'Driving_Licence.png', { mimeType: 'image/png' });
  await Document.create({
    userId: user._id,
    title: 'Maharashtra Driving Licence (LMV)',
    category: 'Driving Licence',
    documentNumber: 'MH12-20190045612',
    expiryDate: soonDate,
    gridFsFileId: soonGridId,
    encryptedFilePath: soonGridId.toString(),
    originalFileName: 'Driving_Licence.png',
    mimeType: 'image/png',
    ocrText: `UNION OF INDIA DRIVING LICENCE LICENCE NO: MH12-20190045612 VALID UPTO: ${soonStr}`,
    ocrConfidence: 'high',
  });

  // 3. Expiring soon (4 days: Vehicle Insurance)
  const criticalDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 4, 12, 0, 0));
  const critStr = `${String(criticalDate.getUTCDate()).padStart(2, '0')}/${String(criticalDate.getUTCMonth() + 1).padStart(2, '0')}/${criticalDate.getUTCFullYear()}`;
  const critBuf = await createSampleImage('HDFC ERGO Car Insurance', 'Insurance', 'POL-7788991122', critStr);
  const critGridId = await saveEncryptedToGridFS(critBuf, 'Motor_Insurance_Policy.png', { mimeType: 'image/png' });
  await Document.create({
    userId: user._id,
    title: 'HDFC ERGO Comprehensive Motor Insurance',
    category: 'Insurance',
    documentNumber: 'POL-7788991122',
    expiryDate: criticalDate,
    gridFsFileId: critGridId,
    encryptedFilePath: critGridId.toString(),
    originalFileName: 'Motor_Insurance_Policy.png',
    mimeType: 'image/png',
    ocrText: `HDFC ERGO GENERAL INSURANCE POLICY NUMBER: POL-7788991122 PERIOD OF INSURANCE TO: ${critStr}`,
    ocrConfidence: 'high',
  });

  // 4. Expired document (10 days ago: Vehicle Pollution RC)
  const expiredDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 10, 12, 0, 0));
  const expStr = `${String(expiredDate.getUTCDate()).padStart(2, '0')}/${String(expiredDate.getUTCMonth() + 1).padStart(2, '0')}/${expiredDate.getUTCFullYear()}`;
  const expBuf = await createSampleImage('Vehicle Registration Certificate', 'Vehicle RC', 'MH02CB4510', expStr);
  const expGridId = await saveEncryptedToGridFS(expBuf, 'Vehicle_RC_Certificate.png', { mimeType: 'image/png' });
  await Document.create({
    userId: user._id,
    title: 'Car Registration Certificate & PUC',
    category: 'Vehicle RC',
    documentNumber: 'MH02CB4510',
    expiryDate: expiredDate,
    gridFsFileId: expGridId,
    encryptedFilePath: expGridId.toString(),
    originalFileName: 'Vehicle_RC_Certificate.png',
    mimeType: 'image/png',
    ocrText: `VAHAN REGISTRATION CERTIFICATE REGN NO: MH02CB4510 VALID TILL: ${expStr}`,
    ocrConfidence: 'high',
  });

  console.log('[Seed] Seed completed successfully with 4 realistic encrypted test documents stored in MongoDB GridFS!');
  console.log(`[Seed] Login with: ${demoEmail} / Password123!`);

  await disconnectDB();
  process.exit(0);
}

seed().catch((err) => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
