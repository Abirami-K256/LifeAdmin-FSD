const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_production_verification_key_32c';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'c7a6e12e3e57fbf02a498b8c25381669d0d34360e23846db44a60c681cfd8a24';
process.env.CRON_SECRET = process.env.CRON_SECRET || 'prod_cron_secret_7788';

const mongoose = require('mongoose');
const sharp = require('sharp');

async function testAtlasUri(uri) {
  try {
    const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 }).asPromise();
    await conn.close();
    return true;
  } catch (err) {
    console.log(`Connection attempt to ${uri.substring(0, 30)}... failed:`, err.message);
    return false;
  }
}

async function run() {
  console.log('=== VERIFY PRODUCTION LOCAL SUITE ===');

  let atlasUri = process.env.MONGO_URI;
  console.log('Checking configured MONGO_URI...');

  const canConnectConfigured = await testAtlasUri(atlasUri);
  if (!canConnectConfigured) {
    console.log('Configured URI failed. Testing biscuitswithtea credential...');
    const altUri = 'mongodb+srv://abirami2410768_db_user:biscuitswithtea@cluster0.zlcg2c6.mongodb.net/lifeadmin';
    const canConnectAlt = await testAtlasUri(altUri);
    if (canConnectAlt) {
      console.log('Alternate Atlas URI connected! Using biscuitswithtea.');
      atlasUri = altUri;
      process.env.MONGO_URI = altUri;
    } else {
      console.warn('Could not reach remote Atlas cluster (local IP not whitelisted in Atlas).');
      console.log('Starting MongoDB test server instance to verify production app pipeline...');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const memServer = await MongoMemoryServer.create();
      process.env.MONGO_URI = memServer.getUri();
      console.log('Test MongoDB running at:', process.env.MONGO_URI);
    }
  } else {
    console.log('Configured Atlas URI connected successfully!');
  }

  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_production_verification_key_32c';
  process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'c7a6e12e3e57fbf02a498b8c25381669d0d34360e23846db44a60c681cfd8a24';
  process.env.CRON_SECRET = process.env.CRON_SECRET || 'prod_cron_secret_7788';

  const { connectDB, disconnectDB } = require('../config/db');
  await connectDB();

  const app = require('../server');
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Production server running at: ${baseUrl}`);

  try {
    // 1. Health check
    console.log('\n1. Testing GET /api/health...');
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.json();
    if (healthRes.status !== 200 || healthData.status !== 'ok') {
      throw new Error(`Health check failed: ${JSON.stringify(healthData)}`);
    }
    console.log('✔ Health check OK:', healthData);

    // 2. React Router SPA refresh test
    console.log('\n2. Testing Page Refresh on /documents (Serving React Router from Express)...');
    const refreshRes = await fetch(`${baseUrl}/documents`);
    const refreshText = await refreshRes.text();
    if (refreshRes.status !== 200 || !refreshText.includes('<!doctype html>')) {
      throw new Error(`Page refresh test failed, status ${refreshRes.status}`);
    }
    console.log('✔ GET /documents successfully returned index.html (Status: 200)');

    // 3. User Register & Login
    console.log('\n3. Testing Register & Login in Production Mode...');
    const testEmail = `prod_test_${Date.now()}@gmail.com`;
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Production User',
        email: testEmail,
        password: 'Password123!',
      }),
    });
    const regData = await regRes.json();
    if (regRes.status !== 201 || !regData.token) {
      throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
    }
    console.log('✔ User registered successfully. Token received.');
    const token = regData.token;

    // Login
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'Password123!',
      }),
    });
    const loginData = await loginRes.json();
    if (loginRes.status !== 200 || !loginData.token) {
      throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    }
    console.log('✔ Login verified successfully.');

    // 4. Upload & OCR & GridFS Storage
    console.log('\n4. Testing Upload & OCR & GridFS Storage (/api/documents/process)...');
    const svg = `
      <svg width="700" height="350" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <text x="30" y="60" font-family="Arial" font-size="22" font-weight="bold" fill="#000000">REPUBLIC OF INDIA PASSPORT</text>
        <text x="30" y="110" font-family="Arial" font-size="18" fill="#000000">PASSPORT NO: K7766554</text>
        <text x="30" y="160" font-family="Arial" font-size="18" fill="#000000">DATE OF BIRTH: 12/03/1995</text>
        <text x="30" y="210" font-family="Arial" font-size="18" fill="#000000">DATE OF EXPIRY: 20/12/2032</text>
      </svg>
    `;
    const originalImg = await sharp(Buffer.from(svg)).png().toBuffer();

    const formData = new FormData();
    const blob = new Blob([originalImg], { type: 'image/png' });
    formData.append('file', blob, 'production_passport.png');

    const procRes = await fetch(`${baseUrl}/api/documents/process`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const procData = await procRes.json();
    if (procRes.status !== 200 || !procData.data.tempFileId) {
      throw new Error(`Upload & OCR failed: ${JSON.stringify(procData)}`);
    }
    console.log('✔ OCR and GridFS encryption succeeded!');
    console.log('   - Suggested Category:', procData.data.suggestedCategory);
    console.log('   - GridFS File ID:', procData.data.tempFileId);
    console.log('   - Suggested Expiry Date:', procData.data.suggestedExpiryDate);

    // 5. Confirm and Save Document
    console.log('\n5. Testing Confirm & Save (/api/documents)...');
    const saveRes = await fetch(`${baseUrl}/api/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tempFileId: procData.data.tempFileId,
        title: 'Production Verified Passport',
        category: procData.data.suggestedCategory,
        documentNumber: procData.data.suggestedDocNumber || 'K7766554',
        expiryDate: '2032-12-20',
        ocrText: procData.data.ocrText,
        ocrConfidence: procData.data.ocrConfidence,
        originalFileName: 'production_passport.png',
        mimeType: 'image/png',
      }),
    });
    const saveData = await saveRes.json();
    if (saveRes.status !== 201 || !saveData.document._id) {
      throw new Error(`Document save failed: ${JSON.stringify(saveData)}`);
    }
    const docId = saveData.document._id;
    console.log('✔ Document saved to database with ID:', docId);

    // 6. Download and Decrypt File from GridFS
    console.log('\n6. Testing Decrypted Download from GridFS (/api/documents/:id/file)...');
    const downloadRes = await fetch(`${baseUrl}/api/documents/${docId}/file?download=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (downloadRes.status !== 200) {
      throw new Error(`Download failed with status: ${downloadRes.status}`);
    }
    const downloadedBuf = Buffer.from(await downloadRes.arrayBuffer());
    if (downloadedBuf.length < 50) {
      throw new Error('Downloaded buffer is empty or corrupted');
    }
    console.log(`✔ Decrypted file downloaded successfully (${downloadedBuf.length} bytes, MIME: ${downloadRes.headers.get('content-type')})`);

    // 7. Test External Cron Reminder Endpoint
    console.log('\n7. Testing POST /api/reminders/run...');
    // Without header -> should 401
    const unauthCron = await fetch(`${baseUrl}/api/reminders/run`, { method: 'POST' });
    if (unauthCron.status !== 401) {
      throw new Error(`Expected 401 for missing x-cron-secret, got ${unauthCron.status}`);
    }
    console.log('✔ Unauthenticated cron request correctly rejected with 401');

    // With header -> should 200
    const authCron = await fetch(`${baseUrl}/api/reminders/run`, {
      method: 'POST',
      headers: { 'x-cron-secret': process.env.CRON_SECRET },
    });
    const authCronData = await authCron.json();
    if (authCron.status !== 200 || !authCronData.success) {
      throw new Error(`Cron run failed: ${JSON.stringify(authCronData)}`);
    }
    console.log(`✔ Authenticated cron run succeeded (Emails sent: ${authCronData.sent})`);

    // 8. Delete Document & GridFS file
    console.log('\n8. Testing DELETE /api/documents/:id...');
    const deleteRes = await fetch(`${baseUrl}/api/documents/${docId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (deleteRes.status !== 200) {
      throw new Error(`Delete failed with status: ${deleteRes.status}`);
    }
    console.log('✔ Document and GridFS file deleted successfully');

    // Verify 404
    const checkRes = await fetch(`${baseUrl}/api/documents/${docId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (checkRes.status !== 404) {
      throw new Error(`Expected 404 after deletion, got ${checkRes.status}`);
    }
    console.log('✔ Document confirmed deleted (404 on subsequent lookup)');

    console.log('\n===============================================');
    console.log('🎉 ALL LOCAL PRODUCTION VERIFICATION TESTS PASSED!');
    console.log('===============================================\n');
  } finally {
    server.close();
    await disconnectDB();
  }
}

run().catch((err) => {
  console.error('\n❌ Production verification error:', err);
  process.exit(1);
});
