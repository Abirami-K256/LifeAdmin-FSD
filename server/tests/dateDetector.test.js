const test = require('node:test');
const assert = require('node:assert/strict');
const { detectExpiryDate, parseDateIndian } = require('../services/dateDetector.service');
const { detectCategory, extractDocumentNumber } = require('../utils/categoryKeywords');

test('Unit Tests: Expiry Date Detection & Category Guessing', async (t) => {
  await t.test('1. Passport OCR: correctly detects expiry date and ignores DOB and Issue Date', () => {
    const passportText = `
      REPUBLIC OF INDIA
      PASSPORT
      Type: P  Country Code: IND  Passport No: J8746352
      Given Names: RAHUL
      Surname: VERMA
      Nationality: INDIAN
      Sex: M
      Date of Birth: 15/07/1992
      Place of Birth: MUMBAI
      Date of Issue: 22/10/2018
      Date of Expiry: 21/10/2028
      Place of Issue: MUMBAI
      P<INDVERMA<<RAHUL<<<<<<<<<<<<<<<<<<<<<<<<<<<
      J8746352<8IND9207152M2810217<<<<<<<<<<<<<<04
    `;

    // Category detection
    const category = detectCategory(passportText);
    assert.equal(category, 'Passport', 'Should detect category as Passport');

    // Document number
    const docNumber = extractDocumentNumber(passportText, category);
    assert.equal(docNumber, 'J8746352', 'Should extract passport number');

    // Expiry date detection
    const result = detectExpiryDate(passportText);
    assert.ok(result.expiryDate instanceof Date, 'Should return a valid Date object');
    assert.equal(result.confidence, 'high', 'Confidence should be high when explicit keyword is present');
    
    // Check that it did NOT pick DOB (1992) or Issue Date (2018)
    assert.equal(result.expiryDate.getFullYear(), 2028, 'Year should be 2028');
    assert.equal(result.expiryDate.getMonth(), 9, 'Month should be October (0-indexed 9)');
    assert.equal(result.expiryDate.getDate(), 21, 'Day should be 21');
  });

  await t.test('2. Driving Licence OCR: detects "Valid Upto" and ignores DOB and DOI', () => {
    const drivingLicenceText = `
      UNION OF INDIA DRIVING LICENCE
      TRANSPORT DEPARTMENT MAHARASHTRA
      LICENCE NO: MH12-20190045612
      Name: ANITA PATEL
      Father: SURESH PATEL
      DOB: 08-03-1995
      Blood Group: B+
      DOI: 14-04-2019
      COV: LMV, MCWG
      VALID UPTO: 13-04-2039
      ISSUING AUTHORITY: RTO PUNE
    `;

    const category = detectCategory(drivingLicenceText);
    assert.equal(category, 'Driving Licence', 'Should detect Driving Licence');

    const result = detectExpiryDate(drivingLicenceText);
    assert.ok(result.expiryDate instanceof Date, 'Should detect valid expiry date');
    assert.equal(result.confidence, 'high', 'Confidence should be high');
    assert.equal(result.expiryDate.getFullYear(), 2039, 'Year should be 2039');
    assert.equal(result.expiryDate.getMonth(), 3, 'Month should be April (0-indexed 3)');
    assert.equal(result.expiryDate.getDate(), 13, 'Day should be 13');
  });

  await t.test('3. Insurance Policy OCR: detects "Valid Till" / "Period of Insurance to"', () => {
    const insuranceText = `
      HDFC ERGO GENERAL INSURANCE COMPANY LIMITED
      MOTOR VEHICLE PACKAGE POLICY SCHEDULE
      Policy Number: 231120459811000
      Insured Name: VIKRAM MALHOTRA
      Vehicle Reg No: MH02CB4510
      Premium Paid: INR 8,450
      Period of Insurance:
      From: 00:00 hrs on 15/09/2024
      Valid Till: 23:59 hrs on 14/09/2027
      Sum Assured: INR 6,50,000
    `;

    const category = detectCategory(insuranceText);
    assert.equal(category, 'Insurance', 'Should detect Insurance');

    const result = detectExpiryDate(insuranceText);
    assert.ok(result.expiryDate instanceof Date, 'Should parse valid date');
    assert.equal(result.confidence, 'high', 'Confidence should be high');
    assert.equal(result.expiryDate.getFullYear(), 2027, 'Year should be 2027');
    assert.equal(result.expiryDate.getMonth(), 8, 'Month should be September (0-indexed 8)');
    assert.equal(result.expiryDate.getDate(), 14, 'Day should be 14');
  });

  await t.test('4. Fallback: No keyword found, picks latest future date with low confidence', () => {
    const unformattedText = `
      Gym Membership Agreement
      Member ID: GYM-99182
      Created on: 01/01/2024
      Notice date: 15/06/2024
      Membership renewal: 30/12/2028
    `;

    const result = detectExpiryDate(unformattedText);
    assert.ok(result.expiryDate instanceof Date);
    assert.equal(result.confidence, 'low', 'Confidence should be low when no keyword matches directly');
    assert.equal(result.expiryDate.getFullYear(), 2028);
    assert.equal(result.expiryDate.getMonth(), 11); // December
    assert.equal(result.expiryDate.getDate(), 30);
  });
});
