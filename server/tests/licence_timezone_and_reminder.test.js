const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const sharp = require('sharp');
const app = require('../server');
const { connectDB, disconnectDB } = require('../config/db');
const Document = require('../models/Document');
const User = require('../models/User');
const { detectExpiryDate } = require('../services/dateDetector.service');
const { checkAndSendReminders } = require('../services/reminder.service');

let server;
let baseUrl;
let token;
let user;

test('Licence Expiry "10/10/2026" Timezone & 1-Day Reminder Test', async (t) => {
  t.before(async () => {
    await connectDB();
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api`;

    // Create test user
    const testEmail = `licence_test_${Date.now()}@example.com`;
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Licence Holder',
        email: testEmail,
        password: 'Password123!',
      }),
    });
    const regData = await regRes.json();
    token = regData.token;
    user = await User.findOne({ email: testEmail });
    await Document.deleteMany({ userId: user._id });
  });

  t.after(async () => {
    if (user) {
      await Document.deleteMany({ userId: user._id });
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  await t.test('1. detectExpiryDate parses "Valid Upto: 10/10/2026" as Oct 10, 2026 at UTC noon', () => {
    const licenceOcrText = `
      UNION OF INDIA DRIVING LICENCE
      TRANSPORT DEPARTMENT
      LICENCE NO: MH12-20260099881
      NAME: AMIT KULKARNI
      DOB: 15/05/1990
      DOI: 11/10/2021
      VALID UPTO: 10/10/2026
    `;

    const res = detectExpiryDate(licenceOcrText);
    assert.ok(res.expiryDate instanceof Date, 'Must return a Date');
    assert.equal(res.confidence, 'high');
    assert.equal(res.matchedKeyword, 'valid upto');

    // Calendar date checks in UTC
    assert.equal(res.expiryDate.getUTCFullYear(), 2026, 'Year must be 2026');
    assert.equal(res.expiryDate.getUTCMonth(), 9, 'Month must be October (9)');
    assert.equal(res.expiryDate.getUTCDate(), 10, 'Day must be 10 (not 9!)');
    assert.equal(res.expiryDate.getUTCHours(), 12, 'Hours must be 12 (UTC noon)');

    const isoDateStr = res.expiryDate.toISOString().split('T')[0];
    assert.equal(isoDateStr, '2026-10-10', 'Date string must be 2026-10-10');
  });

  await t.test('2. Uploading licence via API stores correct date without timezone shifting', async () => {
    // Generate dynamic tomorrow date so test succeeds on any calendar date
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12, 0, 0));
    const tomDay = String(tomorrow.getUTCDate()).padStart(2, '0');
    const tomMonth = String(tomorrow.getUTCMonth() + 1).padStart(2, '0');
    const tomYear = tomorrow.getUTCFullYear();
    const tomDmy = `${tomDay}/${tomMonth}/${tomYear}`;
    const tomYmd = `${tomYear}-${tomMonth}-${tomDay}`;

    // Generate SVG for driving licence
    const svg = `
      <svg width="700" height="350" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <text x="40" y="60" font-family="Arial" font-size="22" font-weight="bold" fill="#000000">UNION OF INDIA DRIVING LICENCE</text>
        <text x="40" y="110" font-family="Arial" font-size="18" fill="#000000">LICENCE NO: MH12-20260099881</text>
        <text x="40" y="160" font-family="Arial" font-size="18" fill="#000000">DOB: 15/05/1990</text>
        <text x="40" y="210" font-family="Arial" font-size="18" fill="#000000">VALID UPTO: ${tomDmy}</text>
      </svg>
    `;
    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

    const formData = new FormData();
    const blob = new Blob([pngBuffer], { type: 'image/png' });
    formData.append('file', blob, 'sample_licence.png');

    const procRes = await fetch(`${baseUrl}/documents/process`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    assert.equal(procRes.status, 200);
    const procData = await procRes.json();

    // Verify suggested expiry date
    assert.equal(procData.data.suggestedCategory, 'Driving Licence');
    const isoSuggested = new Date(procData.data.suggestedExpiryDate).toISOString().split('T')[0];
    assert.equal(isoSuggested, tomYmd, `Suggested date must be ${tomYmd}`);

    // Confirm and save document
    const saveRes = await fetch(`${baseUrl}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tempFileId: procData.data.tempFileId,
        title: 'Indian Driving Licence',
        category: 'Driving Licence',
        documentNumber: procData.data.suggestedDocNumber || 'MH12-20260099881',
        expiryDate: tomYmd,
        ocrText: procData.data.ocrText,
        ocrConfidence: procData.data.ocrConfidence,
        originalFileName: 'sample_licence.png',
        mimeType: 'image/png',
      }),
    });
    assert.equal(saveRes.status, 201);
    const saveBody = await saveRes.json();
    const docId = saveBody.document._id;

    // Fetch document details via GET /api/documents/:id
    const getRes = await fetch(`${baseUrl}/documents/${docId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(getRes.status, 200);
    const getBody = await getRes.json();
    const doc = getBody.document;

    // Stored expiry date checks
    const expDate = new Date(doc.expiryDate);
    assert.equal(expDate.getUTCDate(), tomorrow.getUTCDate(), 'Expiry calendar date must match tomorrow');
    assert.equal(expDate.getUTCMonth(), tomorrow.getUTCMonth());
    assert.equal(expDate.getUTCFullYear(), tomorrow.getUTCFullYear());

    // Check daysUntilExpiry calculation
    assert.equal(doc.daysUntilExpiry, 1, 'Document expiring tomorrow must have daysUntilExpiry === 1');
  });

  await t.test('3. Document expiring tomorrow receives the 1-day reminder, and 30d/7d are NOT marked as sent', async () => {
    // Find our created licence document
    const doc = await Document.findOne({ userId: user._id });
    assert.ok(doc, 'Document should exist');
    assert.equal(doc.daysUntilExpiry, 1, 'daysUntilExpiry should be 1');
    assert.deepEqual(doc.remindersSent, [], 'remindersSent should be empty initially');

    // Run reminder job
    const reminderResult = await checkAndSendReminders();
    assert.ok(reminderResult.sent >= 1, 'At least 1 reminder email must be sent');

    // Re-fetch document from DB
    const updatedDoc = await Document.findById(doc._id);
    assert.deepEqual(
      updatedDoc.remindersSent,
      [1],
      'Document expiring tomorrow must ONLY have [1] in remindersSent (30 and 7 must NOT be marked sent)'
    );

    // Verify reminder details in report
    const detail = reminderResult.details.find((d) => d.documentId.toString() === doc._id.toString());
    assert.ok(detail, 'Reminder details should include this document');
    assert.equal(detail.interval, 1, 'Triggered interval must be 1 (1-day reminder)');
    assert.equal(detail.daysUntilExpiry, 1);
  });

  await t.test('4. Running reminder job again does NOT send duplicate reminders', async () => {
    const docBefore = await Document.findOne({ userId: user._id });
    assert.deepEqual(docBefore.remindersSent, [1]);

    const secondRun = await checkAndSendReminders();
    const docDetail = secondRun.details.find((d) => d.documentId.toString() === docBefore._id.toString());
    assert.equal(docDetail, undefined, 'No duplicate reminder should be sent for this document');

    const docAfter = await Document.findById(docBefore._id);
    assert.deepEqual(docAfter.remindersSent, [1], 'remindersSent must remain [1]');
  });
});
