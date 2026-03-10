// ---------------------------------------------------------------------------
// GTIN validation, normalization, and formatting
//
// Supports GTIN-8, GTIN-12 (UPC-A), GTIN-13 (EAN-13), GTIN-14.
// Canonical storage format: GTIN-14 (14 digits, zero-padded left).
//
// GS1 check digit: mod-10 weighted algorithm.
// https://www.gs1.org/services/check-digit-calculator
// ---------------------------------------------------------------------------

export type GtinLength = 8 | 12 | 13 | 14;

export interface GtinParseResult {
  valid: boolean;
  normalized: string | null; // GTIN-14 (14 digits) or null if invalid
  original: string;
  inputLength: GtinLength | null;
  error?: string;
}

const VALID_LENGTHS = new Set([8, 12, 13, 14]);

/**
 * Calculate the GS1 mod-10 check digit for a digit string (without check digit).
 *
 * Algorithm: pad to even length, then from the right the last digit
 * position (check digit position) alternates multipliers 3, 1, 3, 1...
 * For a string WITHOUT the check digit, we compute what the check digit should be.
 */
export function calculateCheckDigit(digitsWithoutCheck: string): number {
  // The full GTIN has N digits, last is check. We have N-1 digits.
  // To compute: pad the digits to form the full length minus check,
  // then weight from right: positions alternate ×3, ×1 starting from
  // the rightmost data digit (position adjacent to check digit = ×3).
  const digits = digitsWithoutCheck;
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    const d = parseInt(digits[i], 10);
    // Rightmost data digit (i = digits.length - 1) gets ×3,
    // next gets ×1, alternating
    const weight = (digits.length - 1 - i) % 2 === 0 ? 3 : 1;
    sum += d * weight;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * Validate a GTIN check digit using the GS1 mod-10 algorithm.
 * Works on any valid-length GTIN (8, 12, 13, 14).
 */
export function validateCheckDigit(digits: string): boolean {
  if (digits.length < 2) return false;
  const data = digits.slice(0, -1);
  const check = parseInt(digits[digits.length - 1], 10);
  return calculateCheckDigit(data) === check;
}

/**
 * Check if a string looks like it could be a GTIN (8, 12, 13, or 14 digits).
 * Does NOT validate check digit — use parseGtin for full validation.
 */
export function looksLikeGtin(input: string): boolean {
  const cleaned = input.trim();
  return /^\d{8}$|^\d{12,14}$/.test(cleaned);
}

/**
 * Parse and validate a GTIN string. Returns normalized GTIN-14.
 * Strips whitespace and hyphens before validation.
 */
export function parseGtin(input: string): GtinParseResult {
  const original = input;
  const cleaned = input.trim().replace(/[-\s]/g, '');

  // Must be all digits
  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, normalized: null, original, inputLength: null, error: 'Contains non-digit characters' };
  }

  // Must be a valid GTIN length
  if (!VALID_LENGTHS.has(cleaned.length)) {
    return { valid: false, normalized: null, original, inputLength: null, error: `Invalid GTIN length: ${cleaned.length}. Must be 8, 12, 13, or 14` };
  }

  const inputLength = cleaned.length as GtinLength;

  // Validate check digit
  if (!validateCheckDigit(cleaned)) {
    return { valid: false, normalized: null, original, inputLength, error: 'Invalid check digit' };
  }

  // Zero-pad to 14 digits
  const normalized = cleaned.padStart(14, '0');

  return { valid: true, normalized, original, inputLength };
}

/**
 * Normalize a string to GTIN-14 if valid. Returns null if invalid.
 */
export function normalizeGtin(input: string): string | null {
  return parseGtin(input).normalized;
}

/**
 * Format a GTIN-14 for display in its natural compact form.
 * Strips leading zeros to show GTIN-8, UPC-12, EAN-13, or GTIN-14.
 */
export function formatGtinForDisplay(gtin14: string): string {
  if (gtin14.length !== 14) return gtin14;

  // Try to show in the most natural format
  // GTIN-14: if first digit is non-zero (packaging indicator), show all 14
  if (gtin14[0] !== '0') return gtin14;

  // Strip leading zeros and check resulting length
  const stripped = gtin14.replace(/^0+/, '');

  // If it reduces to 12 or fewer digits, it's a UPC-A — show as 12
  if (stripped.length <= 12) return gtin14.slice(2); // always 12 digits

  // If 13 digits remain, it's an EAN-13
  if (stripped.length === 13) return gtin14.slice(1);

  return gtin14;
}
