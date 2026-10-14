import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { IdTypePrefix } from '../types';

export interface IdGeneratorOptions {
  type: IdTypePrefix;
  customText?: string;
  useCustom?: boolean;
  includePrefixLetter?: boolean; // In custom ID: toggle ID letter prefix (C-, I-, Q-). Can only be toggled in custom ID.
  includeRandomSuffix?: boolean; // In custom ID: toggle trailing 4 digits. In pre-made/standard: stays ON (true).
}

const COLLECTION_MAP: Record<IdTypePrefix, string> = {
  I: 'invoices',
  Q: 'quotations',
  T: 'transactions',
  D: 'shipments',
  C: 'customers',
};

/**
 * Generate a 4-digit random number string (1000 - 9999)
 */
export function generateRandomCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Utility to strip trailing 4-digit random codes from an existing ID
 * e.g. "C202610124102" -> "C20261012", "CUST-101-4819" -> "CUST-101",
 *      "I202610129927" -> "I20261012", "BILL-VIP-5521" -> "BILL-VIP"
 */
export function stripRandomSuffix(id: string): string {
  if (!id) return id;
  const clean = id.trim();
  // Strip trailing dash/underscore followed by 4 digits: "-4819" or "_4819"
  if (/[-_][0-9]{4}$/.test(clean)) {
    return clean.replace(/[-_][0-9]{4}$/, '');
  }
  // Strip trailing 4 digits from standard format: e.g. C202610124102 (len 13) -> C20261012 (len 9)
  if (clean.length >= 12 && /^[A-Z][0-9]{8}[0-9]{4}$/.test(clean)) {
    return clean.slice(0, -4);
  }
  // General fallback: if length > 8 and ends in 4 digits preceded by non-digit
  if (clean.length > 8 && /[0-9]{4}$/.test(clean)) {
    return clean.slice(0, -4);
  }
  return clean;
}

/**
 * Get current date string in YYYYMMDD format
 */
export function getYYYYMMDD(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Real-time preview helper for Custom ID vs Pre-made ID
 */
export function buildCustomIdPreview(options: {
  type: IdTypePrefix;
  customText: string;
  includePrefixLetter: boolean;
  includeRandomDigits: boolean;
}): string {
  if (!options.customText.trim()) {
    // Standard Pre-made ID: ID letter and digits STAY ON
    const datePart = getYYYYMMDD();
    return `${options.type}${datePart}XXXX`;
  }

  let clean = options.customText.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');

  if (!options.includePrefixLetter) {
    if (clean.startsWith(`${options.type}-`) || clean.startsWith(`${options.type}_`)) {
      clean = clean.slice(2);
    }
  } else {
    if (
      !clean.startsWith(`${options.type}-`) &&
      !clean.startsWith(`${options.type}_`) &&
      !(clean.startsWith(options.type) && clean.length > 1 && /^[A-Z][0-9]/.test(clean))
    ) {
      clean = `${options.type}-${clean}`;
    }
  }

  if (options.includeRandomDigits) {
    return `${clean}-XXXX`;
  }
  return clean;
}

/**
 * Format custom ID string with options applied
 */
export function formatCustomIdValue(options: {
  type: IdTypePrefix;
  customText: string;
  includePrefixLetter: boolean;
  includeRandomDigits: boolean;
}): string {
  let clean = options.customText.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');

  if (!options.includePrefixLetter) {
    if (clean.startsWith(`${options.type}-`) || clean.startsWith(`${options.type}_`)) {
      clean = clean.slice(2);
    }
  } else {
    if (
      !clean.startsWith(`${options.type}-`) &&
      !clean.startsWith(`${options.type}_`) &&
      !(clean.startsWith(options.type) && clean.length > 1 && /^[A-Z][0-9]/.test(clean))
    ) {
      clean = `${options.type}-${clean}`;
    }
  }

  if (options.includeRandomDigits) {
    const randomPart = generateRandomCode();
    return `${clean}-${randomPart}`;
  }
  return clean;
}

/**
 * Generates an ID according to the formula:
 * - Pre-made / Non-custom: ID letter and digits STAY ON (e.g. C202610144102)
 * - Custom ID: ID letter and 4-digit code can be individually turned ON/OFF
 */
export function generateRawId(options: IdGeneratorOptions): string {
  const {
    type,
    customText,
    useCustom,
    includePrefixLetter = true,
    includeRandomSuffix,
  } = options;

  // 1. Pre-made automatic ID (when custom is not used): ID letter and digits stay ON!
  if (!useCustom || !customText || !customText.trim()) {
    const datePart = getYYYYMMDD();
    // In pre-made, random 4-digit suffix always stays ON (unless explicitly disabled)
    if (includeRandomSuffix !== false) {
      const randomPart = generateRandomCode();
      return `${type}${datePart}${randomPart}`;
    }
    return `${type}${datePart}`;
  }

  // 2. Custom ID: user can toggle ID letter and 4-digit random code
  let cleanCustom = customText.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');

  if (!includePrefixLetter) {
    if (cleanCustom.startsWith(`${type}-`) || cleanCustom.startsWith(`${type}_`)) {
      cleanCustom = cleanCustom.slice(2);
    }
  } else {
    if (
      !cleanCustom.startsWith(`${type}-`) &&
      !cleanCustom.startsWith(`${type}_`) &&
      !(cleanCustom.startsWith(type) && cleanCustom.length > 1 && /^[A-Z][0-9]/.test(cleanCustom))
    ) {
      cleanCustom = `${type}-${cleanCustom}`;
    }
  }

  if (includeRandomSuffix) {
    const randomPart = generateRandomCode();
    return `${cleanCustom}-${randomPart}`;
  }

  return cleanCustom;
}

/**
 * Collision-checked ID generation against Firestore collections.
 * If includeRandomSuffix is false, increments clean sequential numbers (-01, -02, etc.)
 */
export async function generateUniqueId(options: IdGeneratorOptions): Promise<string> {
  const collectionName = COLLECTION_MAP[options.type];
  const isPreMade = !options.useCustom || !options.customText || !options.customText.trim();
  const hasRandom = isPreMade ? options.includeRandomSuffix !== false : !!options.includeRandomSuffix;
  const baseId = generateRawId(options);

  // If random suffix is included (standard pre-made or custom with 4-digits enabled)
  if (hasRandom) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidateId = generateRawId(options);
      try {
        const docRef = doc(db, collectionName, candidateId);
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) {
          return candidateId;
        }
      } catch {
        return candidateId;
      }
    }
    return `${baseId}-${Date.now().toString().slice(-4)}`;
  }

  // Clean ID without random 4 digits: check baseId, and if collision occurs, append -01, -02...
  for (let seq = 0; seq < 30; seq++) {
    const candidateId = seq === 0 ? baseId : `${baseId}-${String(seq).padStart(2, '0')}`;
    try {
      const docRef = doc(db, collectionName, candidateId);
      const snapshot = await getDoc(docRef);
      if (!snapshot.exists()) {
        return candidateId;
      }
    } catch {
      return candidateId;
    }
  }

  return baseId;
}

/**
 * Generates a 6-digit claim verification code for 72-hour claims
 */
export function generateClaimCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
