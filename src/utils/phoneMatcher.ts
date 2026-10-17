import { Customer } from '../types';

/**
 * Normalizes input by extracting the raw 10-digit Indian mobile number.
 * Handles:
 * - "+91 98765-43210" -> "9876543210"
 * - "+919876543210" -> "9876543210"
 * - "09876543210" -> "9876543210"
 * - "919876543210" -> "9876543210"
 * - "9876543210" -> "9876543210"
 */
export function extractRawPhone(input: string): string {
  if (!input) return '';
  // Remove all non-numeric characters
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';

  // If starts with 91 and has 12 digits, strip 91
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }

  // If starts with 0 and has 11 digits, strip 0
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }

  // If exactly 10 digits
  if (digits.length === 10) {
    return digits;
  }

  // If longer than 10 digits, take the trailing 10 digits
  if (digits.length > 10) {
    return digits.slice(-10);
  }

  // If shorter than 10 digits, return raw digits
  return digits;
}

/**
 * Generates candidate prefix combinations for a given raw number:
 * 1. raw (e.g. "9876543210")
 * 2. 0 + raw (e.g. "09876543210")
 * 3. +91 + raw (e.g. "+919876543210")
 * 4. +91 + " " + raw (e.g. "+91 9876543210")
 * 5. 91 + raw (e.g. "919876543210")
 */
export function generatePhoneVariants(raw: string): string[] {
  if (!raw) return [];
  const cleanRaw = raw.trim();
  const variants = [
    cleanRaw,
    `0${cleanRaw}`,
    `+91${cleanRaw}`,
    `+91 ${cleanRaw}`,
    `91${cleanRaw}`,
    `+91-${cleanRaw}`,
  ];
  return Array.from(new Set(variants));
}

/**
 * Checks if a string looks like a numeric phone number
 */
export function isLikelyPhoneNumber(input: string): boolean {
  if (!input) return false;
  const digits = input.replace(/\D/g, '');
  // Indian phone numbers are 10 digits (or 11 with 0, 12 with 91)
  return digits.length >= 7 && (digits.length === 10 || digits.length === 11 || digits.length === 12 || input.includes('+91'));
}

export interface MatchCustomerResult {
  customer: Customer | null;
  matchType: 'ID' | 'PHONE_EXACT' | 'PHONE_RAW_MATCH' | 'PIN_OR_CODE' | 'NONE';
  matchedVariant?: string;
}

/**
 * Bidirectional Customer Matcher:
 * Resolves a customer record from either:
 * 1. Direct Customer ID (e.g. C202610094102 or custom code)
 * 2. Raw phone digits (e.g. 9876543210)
 * 3. Prefixed phone variants (+91..., 91..., 0...)
 * 4. Stored customer phone normalization: matches even if the stored phone
 *    is saved as "+91 98765 43210" and user enters "9876543210", or vice-versa!
 */
export function findCustomerByCodeOrPhone(
  input: string,
  customerList: Customer[]
): MatchCustomerResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { customer: null, matchType: 'NONE' };
  }

  const upper = trimmed.toUpperCase();

  // Step 1: Check direct Customer ID match
  const idMatch = customerList.find(
    (c) => c.id.toUpperCase() === upper
  );
  if (idMatch) {
    return { customer: idMatch, matchType: 'ID' };
  }

  // Step 2: Extract raw 10-digit number
  const rawInput = extractRawPhone(trimmed);

  if (rawInput && rawInput.length >= 7) {
    const candidateVariants = generatePhoneVariants(rawInput);

    // 2a. Direct string match on any variant
    for (const cust of customerList) {
      const custPhone = (cust.phone || '').trim();
      if (candidateVariants.includes(custPhone)) {
        return { customer: cust, matchType: 'PHONE_EXACT', matchedVariant: custPhone };
      }
    }

    // 2b. Bidirectional raw normalization: extract raw from stored customer phone
    // and compare with raw extracted from user input
    for (const cust of customerList) {
      const custRaw = extractRawPhone(cust.phone || '');
      if (custRaw && custRaw === rawInput) {
        return { customer: cust, matchType: 'PHONE_RAW_MATCH', matchedVariant: rawInput };
      }
    }
  }

  // Step 3: Check internalName / externalName exact match (fallback)
  const nameMatch = customerList.find(
    (c) => c.externalName.trim().toUpperCase() === upper || c.internalName.trim().toUpperCase() === upper
  );
  if (nameMatch) {
    return { customer: nameMatch, matchType: 'PIN_OR_CODE' };
  }

  return { customer: null, matchType: 'NONE' };
}
