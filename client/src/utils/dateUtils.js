/**
 * Formats a stored date into a user-friendly calendar string WITHOUT timezone shifting.
 * Using UTC getters ensures that a date stored as 10/10/2026 never renders as 09/10/2026.
 *
 * @param {string|Date} dateInput
 * @param {'short'|'medium'|'long'|'numeric'} formatType
 * @returns {string}
 */
export function formatCalendarDate(dateInput, formatType = 'medium') {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';

  const day = String(d.getUTCDate()).padStart(2, '0');
  const monthNum = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();

  const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fullMonths = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  if (formatType === 'numeric') {
    return `${day}/${monthNum}/${year}`;
  }

  if (formatType === 'long') {
    return `${day} ${fullMonths[d.getUTCMonth()]} ${year}`;
  }

  // default 'medium' e.g. 10 Oct 2026
  return `${day} ${shortMonths[d.getUTCMonth()]} ${year}`;
}

/**
 * Converts a date into a YYYY-MM-DD string for HTML5 <input type="date" />.
 * Uses UTC components to prevent one-day-off date picker issues.
 */
export function toDateInputValue(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
