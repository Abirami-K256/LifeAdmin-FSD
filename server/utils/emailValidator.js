const MISSPELLED_DOMAINS = {
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmail.in': 'gmail.com',
  'gamil.in': 'gmail.com',
  'yahooo.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outlook.con': 'outlook.com',
};

function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email address is required.' };
  }
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }

  const atIndex = trimmed.lastIndexOf('@');
  const domain = trimmed.substring(atIndex + 1);

  if (MISSPELLED_DOMAINS[domain]) {
    const suggestion = MISSPELLED_DOMAINS[domain];
    return {
      valid: false,
      error: `Invalid email address. Did you mean ${suggestion}?`,
      suggestion,
    };
  }

  return { valid: true, email: trimmed };
}

module.exports = {
  validateEmail,
  MISSPELLED_DOMAINS,
};
