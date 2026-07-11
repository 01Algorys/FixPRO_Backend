const { parsePhoneNumberFromString } = require('libphonenumber-js');

// Normalizes a phone number to E.164 (default region Tunisia, matching the
// app's existing +216 assumption). Returns null if unparseable/invalid.
const normalizePhone = (phone) => {
  if (!phone) return null;
  const parsed = parsePhoneNumberFromString(phone, 'TN');
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number; // E.164, e.g. +21655838896
};

module.exports = { normalizePhone };
