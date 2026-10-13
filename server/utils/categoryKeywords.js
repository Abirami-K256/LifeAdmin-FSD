/**
 * Keyword maps to automatically classify document categories based on OCR text.
 */
const CATEGORY_MAP = [
  {
    category: 'Passport',
    keywords: ['passport', 'republic of india', 'passport no', 'nationality indian', 'type p', 'place of issue', 'p<ind'],
  },
  {
    category: 'Driving Licence',
    keywords: ['driving licence', 'driving license', 'transport department', 'licence no', 'license no', 'lmv', 'mcwg', 'cov', 'badge no', 'union of india driving'],
  },
  {
    category: 'Insurance',
    keywords: ['insurance', 'policy number', 'policy no', 'premium', 'insured', 'sum assured', 'tata aig', 'hdfc ergo', 'icici lombard', 'life insurance', 'general insurance', 'coverage'],
  },
  {
    category: 'Vehicle RC',
    keywords: ['registration certificate', 'rc status', 'chassis no', 'engine no', 'regn no', 'vahan', 'maker classification', 'seating capacity', 'rto', 'm.v.act'],
  },
  {
    category: 'Warranty',
    keywords: ['warranty', 'guarantee', 'serial number', 'warranty period', 'proof of purchase', 'warranty card', 'limited warranty'],
  },
  {
    category: 'Certificate',
    keywords: ['certificate', 'certify that', 'diploma', 'degree', 'academic', 'completion of', 'awarded to', 'university'],
  },
];

/**
 * Guesses the most likely category based on occurrences of keywords in text.
 */
function detectCategory(text) {
  if (!text) return 'Other';
  const lower = text.toLowerCase();

  let bestMatch = 'Other';
  let highestScore = 0;

  for (const item of CATEGORY_MAP) {
    let score = 0;
    for (const kw of item.keywords) {
      if (lower.includes(kw)) {
        score += 1;
      }
    }
    if (score > highestScore) {
      highestScore = score;
      bestMatch = item.category;
    }
  }

  return bestMatch;
}

/**
 * Extracts a candidate document number based on category and regex patterns.
 */
function extractDocumentNumber(text, category) {
  if (!text) return '';
  const clean = text.replace(/\r?\n/g, ' ');

  if (category === 'Passport') {
    // Indian passport: 1 letter followed by 7 digits
    const m = clean.match(/\b([A-Z][0-9]{7})\b/i);
    if (m) return m[1].toUpperCase();
  }

  if (category === 'Driving Licence') {
    // Indian DL e.g. MH12 20180012345 or DL-0420110012345
    const m = clean.match(/\b([A-Z]{2}[-\s]?[0-9]{2}[-\s]?[0-9]{11})\b/i) ||
              clean.match(/licen[cs]e\s*(?:no|number)?[:\s\-#]*([A-Z0-9\-\/]{7,20})/i);
    if (m) return m[1].trim();
  }

  if (category === 'Insurance') {
    const m = clean.match(/policy\s*(?:no|number)?[:\s\-#]*([A-Z0-9\-\/]{6,25})/i);
    if (m) return m[1].trim();
  }

  if (category === 'Vehicle RC') {
    const m = clean.match(/\b([A-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[A-Z]{1,3}[-\s]?[0-9]{4})\b/i);
    if (m) return m[1].trim();
  }

  // Fallback pattern: e.g. "Doc No: 12345" or "Number: 12345"
  const genericMatch = clean.match(/(?:document|doc|certificate|id|serial)\s*(?:no|number|#)?[:\s\-]+([A-Z0-9\-\/]{5,20})/i);
  return genericMatch ? genericMatch[1].trim() : '';
}

module.exports = {
  detectCategory,
  extractDocumentNumber,
};
