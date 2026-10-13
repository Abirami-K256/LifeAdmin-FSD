const chrono = require('chrono-node');

// Keywords that indicate expiry dates
const EXPIRY_KEYWORDS = [
  'date of expiry',
  'expiry date',
  'exp date',
  'valid upto',
  'valid up to',
  'valid till',
  'valid through',
  'valid to',
  'expires on',
  'expires',
  'expiry',
  'renewal date',
  'period of insurance to',
  'insurance valid till',
  'validity',
  'due date',
  'end date',
  'maturity date',
];

// Keywords that should be explicitly IGNORED (DOB, Issue Date, etc.)
const IGNORE_KEYWORDS = [
  'date of birth',
  'birth date',
  'dob',
  'd.o.b',
  'born',
  'date of issue',
  'issue date',
  'issued on',
  'issued',
  'doi',
  'd.o.i',
  'registration date',
  'reg date',
  'mfg date',
  'manufacturing date',
];

const MONTH_NAMES = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/**
 * Parses Indian DD/MM/YYYY or DD-Mon-YYYY date string into a Date object.
 */
function parseDateIndian(str) {
  if (!str) return null;
  const trimmed = str.trim();

  // Pattern 1: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const numMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (numMatch) {
    const day = parseInt(numMatch[1], 10);
    const month = parseInt(numMatch[2], 10) - 1; // 0-indexed
    const year = parseInt(numMatch[3], 10);
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 1950 && year <= 2100) {
      // Store at UTC 12:00:00 (noon) to guarantee consistent calendar date in any timezone
      const d = new Date(Date.UTC(year, month, day, 12, 0, 0));
      return d;
    }
  }

  // Pattern 2: DD-Mon-YYYY e.g. 15-OCT-2028 or 15 Oct 2028
  const textMatch = trimmed.match(/^(\d{1,2})[\s\-\/\.]([A-Za-z]{3,9})[\s\-\/\.](\d{4})$/);
  if (textMatch) {
    const day = parseInt(textMatch[1], 10);
    const mStr = textMatch[2].toLowerCase();
    const month = MONTH_NAMES[mStr] !== undefined ? MONTH_NAMES[mStr] : MONTH_NAMES[mStr.slice(0, 3)];
    const year = parseInt(textMatch[3], 10);
    if (month !== undefined && day >= 1 && day <= 31 && year >= 1950 && year <= 2100) {
      return new Date(Date.UTC(year, month, day, 12, 0, 0));
    }
  }

  // Pattern 3: Mon DD, YYYY e.g. Oct 15, 2028
  const textMatch2 = trimmed.match(/^([A-Za-z]{3,9})[\s\-\.]+(\d{1,2})[,\s\-]+(\d{4})$/);
  if (textMatch2) {
    const mStr = textMatch2[1].toLowerCase();
    const month = MONTH_NAMES[mStr] !== undefined ? MONTH_NAMES[mStr] : MONTH_NAMES[mStr.slice(0, 3)];
    const day = parseInt(textMatch2[2], 10);
    const year = parseInt(textMatch2[3], 10);
    if (month !== undefined && day >= 1 && day <= 31 && year >= 1950 && year <= 2100) {
      return new Date(Date.UTC(year, month, day, 12, 0, 0));
    }
  }

  // Fallback to chrono-node with British/Indian day-first config
  const customChrono = chrono.en.GB;
  const parsed = customChrono.parseDate(trimmed);
  if (parsed && !isNaN(parsed.getTime())) {
    return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0));
  }

  return null;
}

/**
 * Extracts all candidate date strings from a text chunk.
 */
function extractDatesFromChunk(chunk) {
  const dates = [];
  // Regex for DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const r1 = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})\b/g;
  let match;
  while ((match = r1.exec(chunk)) !== null) {
    const d = parseDateIndian(match[1]);
    if (d) dates.push({ date: d, raw: match[1], index: match.index });
  }

  // Regex for DD Mon YYYY / DD-Mon-YYYY
  const r2 = /\b(\d{1,2}[\s\-\/\.][A-Za-z]{3,9}[\s\-\/\.]\d{4})\b/g;
  while ((match = r2.exec(chunk)) !== null) {
    const d = parseDateIndian(match[1]);
    if (d && !dates.some((x) => x.raw === match[1])) {
      dates.push({ date: d, raw: match[1], index: match.index });
    }
  }

  // Regex for Mon DD, YYYY
  const r3 = /\b([A-Za-z]{3,9}\s+\d{1,2},\s*\d{4})\b/g;
  while ((match = r3.exec(chunk)) !== null) {
    const d = parseDateIndian(match[1]);
    if (d && !dates.some((x) => x.raw === match[1])) {
      dates.push({ date: d, raw: match[1], index: match.index });
    }
  }

  return dates;
}

/**
 * Detects the expiry date from OCR text using keywords, chrono-node, and regex.
 *
 * @param {string} text - Raw OCR text
 * @returns {Object} { expiryDate: Date|null, confidence: 'high'|'medium'|'low', matchedKeyword: string|null, rawText: string|null }
 */
function detectExpiryDate(text) {
  if (!text || typeof text !== 'string') {
    return { expiryDate: null, confidence: 'low', matchedKeyword: null, rawText: null };
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const lowerText = text.toLowerCase();
  const now = new Date();

  // Step 1: Scan for explicit Expiry Keywords
  for (const keyword of EXPIRY_KEYWORDS) {
    const kwRegex = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'i');
    
    // Check line by line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (kwRegex.test(line)) {
        // Also check if this line contains an IGNORE keyword (e.g. "Date of Birth / Date of Expiry" confusion)
        const hasIgnore = IGNORE_KEYWORDS.some((ign) => new RegExp(`\\b${ign}\\b`, 'i').test(line));
        
        // Search dates on this line
        let chunk = line;
        // Also include next line if no date on current line
        if (i + 1 < lines.length) {
          chunk += ' ' + lines[i + 1];
        }

        const candidateDates = extractDatesFromChunk(chunk);
        if (candidateDates.length > 0) {
          // If has ignore keyword, pick the date closest after the expiry keyword
          return {
            expiryDate: candidateDates[candidateDates.length - 1].date,
            confidence: hasIgnore ? 'medium' : 'high',
            matchedKeyword: keyword,
            rawText: candidateDates[candidateDates.length - 1].raw,
          };
        }
      }
    }

    // Also check window in whole text around the keyword
    const matchIndex = lowerText.indexOf(keyword);
    if (matchIndex !== -1) {
      const snippet = text.slice(matchIndex, matchIndex + 100);
      const candidates = extractDatesFromChunk(snippet);
      if (candidates.length > 0) {
        return {
          expiryDate: candidates[0].date,
          confidence: 'high',
          matchedKeyword: keyword,
          rawText: candidates[0].raw,
        };
      }
    }
  }

  // Step 2: Collect all dates in text, ignoring those directly associated with DOB / Issue Date
  const allDates = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isIgnoreLine = IGNORE_KEYWORDS.some((ign) => new RegExp(`\\b${ign}\\b`, 'i').test(line));
    if (isIgnoreLine) {
      continue; // Skip lines with DOB or Date of Issue
    }

    const lineDates = extractDatesFromChunk(line);
    for (const d of lineDates) {
      allDates.push(d);
    }
  }

  // If no dates found without ignore lines, extract from entire text using chrono-node GB
  if (allDates.length === 0) {
    const chronoResults = chrono.en.GB.parse(text);
    for (const res of chronoResults) {
      const p = res.start.date();
      const d = new Date(Date.UTC(p.getFullYear(), p.getMonth(), p.getDate(), 12, 0, 0));
      allDates.push({ date: d, raw: res.text });
    }
  }

  // Step 3: Pick the latest future date
  const nowUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0));
  const futureDates = allDates.filter((item) => item.date >= nowUtc);
  if (futureDates.length > 0) {
    // Sort descending by date (latest future date)
    futureDates.sort((a, b) => b.date.getTime() - a.date.getTime());
    return {
      expiryDate: futureDates[0].date,
      confidence: 'low',
      matchedKeyword: 'latest_future_date',
      rawText: futureDates[0].raw,
    };
  }

  // Step 4: If any date exists (even if past), pick the latest one with low confidence
  if (allDates.length > 0) {
    allDates.sort((a, b) => b.date.getTime() - a.date.getTime());
    return {
      expiryDate: allDates[0].date,
      confidence: 'low',
      matchedKeyword: 'fallback_latest_date',
      rawText: allDates[0].raw,
    };
  }

  return {
    expiryDate: null,
    confidence: 'low',
    matchedKeyword: null,
    rawText: null,
  };
}

module.exports = {
  detectExpiryDate,
  parseDateIndian,
};
