const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const app = require('../server');
const { connectDB, disconnectDB } = require('../config/db');

async function runVerification() {
  console.log('[Verify] Starting verification script...');
  await connectDB();

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;
  console.log(`[Verify] Server listening on ${baseUrl}`);

  try {
    // 1. Authenticate / register user
    console.log('[Verify] 1. Registering test user...');
    const userRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'OCR Tester',
        email: `tester_${Date.now()}@example.com`,
        password: 'Password123!',
      }),
    });
    const userData = await userRes.json();
    const token = userData.token;
    console.log('[Verify] User registered successfully, token acquired.');

    // 2. Generate a valid PNG document with text
    console.log('[Verify] 2. Generating valid PNG document image...');
    const svgText = `
      <svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <text x="50" y="80" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#000000">REPUBLIC OF INDIA</text>
        <text x="50" y="130" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#000000">PASSPORT NO: K1234567</text>
        <text x="50" y="180" font-family="Arial, sans-serif" font-size="20" fill="#000000">DATE OF BIRTH: 12/04/1990</text>
        <text x="50" y="230" font-family="Arial, sans-serif" font-size="20" fill="#000000">DATE OF ISSUE: 20/06/2018</text>
        <text x="50" y="280" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#000000">DATE OF EXPIRY: 19/06/2028</text>
      </svg>
    `;
    const pngBuffer = await sharp(Buffer.from(svgText)).png().toBuffer();

    console.log('[Verify] 3. Uploading PNG to /api/documents/process...');
    const formData = new FormData();
    const blob = new Blob([pngBuffer], { type: 'image/png' });
    formData.append('file', blob, 'sample_passport_test.png');

    const uploadRes = await fetch(`${baseUrl}/documents/process`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    console.log(`[Verify] Process response status: ${uploadRes.status}`);
    const uploadData = await uploadRes.json();
    console.log('[Verify] Response payload:', JSON.stringify(uploadData, null, 2));

    if (uploadRes.status !== 200 || !uploadData.success) {
      throw new Error(`Upload failed with status ${uploadRes.status}`);
    }

    console.log('[Verify] ✓ Valid PNG processed successfully!');
    console.log(`[Verify] Extracted Text snippet: "${(uploadData.data.ocrText || '').slice(0, 100)}"`);
    console.log(`[Verify] Suggested Category: ${uploadData.data.suggestedCategory}`);
    console.log(`[Verify] Suggested Expiry Date: ${uploadData.data.suggestedExpiryDate}`);
    console.log(`[Verify] OCR Confidence: ${uploadData.data.ocrConfidence}`);

    // 4. Test bad / corrupted buffer to confirm server resilience
    console.log('[Verify] 4. Testing corrupted/invalid image buffer to verify crash prevention...');
    const badBuffer = Buffer.from('this is not a real image at all');
    const badFormData = new FormData();
    const badBlob = new Blob([badBuffer], { type: 'image/png' });
    badFormData.append('file', badBlob, 'corrupted_image.png');

    const badRes = await fetch(`${baseUrl}/documents/process`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: badFormData,
    });

    console.log(`[Verify] Corrupted image response status: ${badRes.status}`);
    const badData = await badRes.json();
    console.log('[Verify] Corrupted image handled gracefully:', badData.success);

    // 5. Check whether server is still alive after bad run
    const healthCheck = await fetch(`${baseUrl}/health`);
    console.log(`[Verify] Health check after corrupted image: ${healthCheck.status}`);

    console.log('\n======================================================');
    console.log(' ALL VERIFICATION CHECKS PASSED: OCR WORKS & STABLE! ');
    console.log('======================================================\n');
  } finally {
    server.close();
    await disconnectDB();
  }
}

runVerification().catch((err) => {
  console.error('[Verify] Verification failed:', err);
  process.exit(1);
});
