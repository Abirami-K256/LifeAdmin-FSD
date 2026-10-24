const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const app = require('../server');
const { connectDB, disconnectDB } = require('../config/db');

let server;
let baseUrl;
let token;
let createdDocId;

test('End-to-End API Test Suite', async (t) => {
  t.before(async () => {
    await connectDB();
    server = app.listen(0); // Random free port
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api`;
  });

  t.after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  await t.test('1. Health check endpoint responds ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
  });

  await t.test('2. User Registration and JWT generation', async () => {
    const testUser = {
      name: 'Priya Patel',
      email: `priya_${Date.now()}@example.com`,
      password: 'password123',
    };

    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.token, 'Should return a JWT token');
    assert.equal(data.user.name, 'Priya Patel');
    assert.equal(data.user.passwordHash, undefined, 'passwordHash must never be exposed');
    token = data.token;
  });

  await t.test('3. Document process (upload & OCR & encryption)', async () => {
    // Generate dummy test image using Sharp SVG
    const svg = `
      <svg width="600" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <text x="30" y="60" font-family="Arial" font-size="22" fill="#000000">REPUBLIC OF INDIA PASSPORT</text>
        <text x="30" y="110" font-family="Arial" font-size="18" fill="#000000">PASSPORT NO: L8899221</text>
        <text x="30" y="160" font-family="Arial" font-size="18" fill="#000000">DATE OF BIRTH: 10/05/1990</text>
        <text x="30" y="210" font-family="Arial" font-size="18" fill="#000000">DATE OF EXPIRY: 15/08/2030</text>
      </svg>
    `;
    const imgBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

    // Create multipart form-data payload using standard FormData
    const formData = new FormData();
    const blob = new Blob([imgBuffer], { type: 'image/png' });
    formData.append('file', blob, 'sample_passport.png');

    const res = await fetch(`${baseUrl}/documents/process`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.success);
    assert.ok(body.data.tempFileId, 'Must return encrypted tempFileId');
    assert.equal(body.data.suggestedCategory, 'Passport');

    // Confirm and save document
    const saveRes = await fetch(`${baseUrl}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tempFileId: body.data.tempFileId,
        title: 'My Official Passport',
        category: body.data.suggestedCategory,
        documentNumber: body.data.suggestedDocNumber || 'L8899221',
        expiryDate: body.data.suggestedExpiryDate || '2030-08-15',
        ocrText: body.data.ocrText,
        ocrConfidence: body.data.ocrConfidence,
        originalFileName: 'sample_passport.png',
        mimeType: 'image/png',
      }),
    });

    assert.equal(saveRes.status, 201);
    const savedDoc = await saveRes.json();
    assert.ok(savedDoc.document._id);
    createdDocId = savedDoc.document._id;
  });

  await t.test('4. Fetch document stats & list', async () => {
    const statsRes = await fetch(`${baseUrl}/documents/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(statsRes.status, 200);
    const stats = await statsRes.json();
    assert.equal(stats.stats.total, 1);
    assert.equal(stats.stats.safe, 1);

    const listRes = await fetch(`${baseUrl}/documents?search=Passport`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(listRes.status, 200);
    const list = await listRes.json();
    assert.equal(list.count, 1);
    assert.equal(list.documents[0].title, 'My Official Passport');
  });

  await t.test('5. Decrypt and view/download file', async () => {
    const fileRes = await fetch(`${baseUrl}/documents/${createdDocId}/file`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(fileRes.status, 200);
    assert.equal(fileRes.headers.get('content-type'), 'image/png');
    const arrayBuffer = await fileRes.arrayBuffer();
    assert.ok(arrayBuffer.byteLength > 100, 'Decrypted file buffer must not be empty');
  });

  await t.test('6. Trigger reminder job manually', async () => {
    const reminderRes = await fetch(`${baseUrl}/reminders/trigger`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(reminderRes.status, 200);
    const data = await reminderRes.json();
    assert.ok(data.success);
    assert.equal(typeof data.summary.checked, 'number');
  });

  await t.test('6b. Run external cron reminder endpoint with x-cron-secret', async () => {
    process.env.CRON_SECRET = 'test_cron_secret_123';

    // Request with missing header -> 401
    const missingRes = await fetch(`${baseUrl}/reminders/run`, {
      method: 'POST',
    });
    assert.equal(missingRes.status, 401);

    // Request with wrong header -> 401
    const wrongRes = await fetch(`${baseUrl}/reminders/run`, {
      method: 'POST',
      headers: { 'x-cron-secret': 'wrong_secret' },
    });
    assert.equal(wrongRes.status, 401);

    // Request with correct header -> 200
    const successRes = await fetch(`${baseUrl}/reminders/run`, {
      method: 'POST',
      headers: { 'x-cron-secret': 'test_cron_secret_123' },
    });
    assert.equal(successRes.status, 200);
    const successData = await successRes.json();
    assert.ok(successData.success);
    assert.equal(typeof successData.sent, 'number');
  });

  await t.test('7. Update and delete document', async () => {
    // Update
    const updateRes = await fetch(`${baseUrl}/documents/${createdDocId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: 'Updated Passport Title',
      }),
    });
    assert.equal(updateRes.status, 200);
    const updated = await updateRes.json();
    assert.equal(updated.document.title, 'Updated Passport Title');

    // Delete
    const deleteRes = await fetch(`${baseUrl}/documents/${createdDocId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(deleteRes.status, 200);

    // Verify deleted
    const checkRes = await fetch(`${baseUrl}/documents/${createdDocId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(checkRes.status, 404);
  });
});
