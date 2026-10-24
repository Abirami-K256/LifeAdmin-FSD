const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const { validateEmail } = require('../utils/emailValidator');

let server;
let baseUrl;

test('Email Validation and Reset Password Test Suite', async (t) => {
  t.before(async () => {
    await connectDB();
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api`;
  });

  t.after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  await t.test('1. validateEmail rejects all specified misspelled domains with suggestion', () => {
    const misspelledCases = [
      { input: 'user@gamil.com', expected: 'gmail.com' },
      { input: 'user@gmial.com', expected: 'gmail.com' },
      { input: 'user@gmai.com', expected: 'gmail.com' },
      { input: 'user@gmail.co', expected: 'gmail.com' },
      { input: 'user@gmail.con', expected: 'gmail.com' },
      { input: 'user@gmaill.com', expected: 'gmail.com' },
      { input: 'user@gmail.in', expected: 'gmail.com' },
      { input: 'user@gamil.in', expected: 'gmail.com' },
      { input: 'user@yahooo.com', expected: 'yahoo.com' },
      { input: 'user@yahoo.con', expected: 'yahoo.com' },
      { input: 'user@hotmial.com', expected: 'hotmail.com' },
      { input: 'user@hotmail.con', expected: 'hotmail.com' },
      { input: 'user@outlok.com', expected: 'outlook.com' },
      { input: 'user@outlook.con', expected: 'outlook.com' },
    ];

    for (const item of misspelledCases) {
      const res = validateEmail(item.input);
      assert.equal(res.valid, false, `Should reject ${item.input}`);
      assert.ok(
        res.error.includes(`Did you mean ${item.expected}?`),
        `Error for ${item.input} must contain "Did you mean ${item.expected}?", got "${res.error}"`
      );
    }

    // Valid email check
    const validRes = validateEmail('legit.user@gmail.com');
    assert.equal(validRes.valid, true);
    assert.equal(validRes.email, 'legit.user@gmail.com');
  });

  await t.test('2. Registration rejects misspelled domains via API', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Typos',
        email: 'person@gamil.com',
        password: 'Password123!',
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.message.includes('Did you mean gmail.com?'));
  });

  await t.test('3. Reset password validation and flow', async () => {
    const testEmail = `reset_user_${Date.now()}@gmail.com`;

    // First, register a valid user
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Reset Target',
        email: testEmail,
        password: 'InitialPassword123!',
      }),
    });
    assert.equal(regRes.status, 201);

    // Case A: Reject passwords shorter than 8 characters
    const shortRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        newPassword: 'short',
        confirmPassword: 'short',
      }),
    });
    assert.equal(shortRes.status, 400);
    const shortBody = await shortRes.json();
    assert.ok(shortBody.message.includes('8 characters'));

    // Case B: Reject mismatched passwords
    const mismatchRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        newPassword: 'ValidNewPassword123!',
        confirmPassword: 'DifferentPassword123!',
      }),
    });
    assert.equal(mismatchRes.status, 400);
    const mismatchBody = await mismatchRes.json();
    assert.ok(mismatchBody.message.includes('do not match'));

    // Case C: Successfully reset password
    const successRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        newPassword: 'BrandNewSecurePassword123!',
        confirmPassword: 'BrandNewSecurePassword123!',
      }),
    });
    assert.equal(successRes.status, 200);

    // Case D: Verify login works with the new password
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'BrandNewSecurePassword123!',
      }),
    });
    assert.equal(loginRes.status, 200);
    const loginBody = await loginRes.json();
    assert.ok(loginBody.token);

    // Cleanup
    await User.deleteOne({ email: testEmail });
  });
});
