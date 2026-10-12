import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { IdTypePrefix } from '../types';

export interface IdGeneratorOptions {
  type: IdTypePrefix;
  customText?: string;
  useCustom?: boolean;
  includeRandomSuffix?: boolean; // If false (default for custom IDs), removes the 4-digit random code
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
  // General fallback: if length > 7 and ends in 4 digits preceded by non-digit or long string
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
 * Generates an ID according to the formula:
 * Clean: [Type] + [Custom Text | YYYYMMDD] (no random 4-digit code)
 * Or with random suffix if explicitly requested.
 */
export function generateRawId(options: IdGeneratorOptions): string {
  const { type, customText, useCustom, includeRandomSuffix = false } = options;

  if (useCustom && customText && customText.trim()) {
    const cleanCustom = customText.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!includeRandomSuffix) {
      // Clean custom ID: If it already has prefix, use verbatim; else add prefix
      if (cleanCustom.startsWith(type)) {
        return cleanCustom;
      }
      return `${type}-${cleanCustom}`;
    }
    const randomPart = generateRandomCode();
    return `${type}${cleanCustom}${randomPart}`;
  }

  const datePart = getYYYYMMDD();
  if (includeRandomSuffix) {
    const randomPart = generateRandomCode();
    return `${type}${datePart}${randomPart}`;
  }

  // Clean date-based format without random 4-digits
  return `${type}${datePart}`;
}

/**
 * Collision-checked ID generation against Firestore collections.
 * If includeRandomSuffix is false, increments clean sequential numbers (-01, -02, etc.)
 */
export async function generateUniqueId(options: IdGeneratorOptions): Promise<string> {
  const collectionName = COLLECTION_MAP[options.type];
  const baseId = generateRawId(options);

  // If random suffix is included, test up to 5 random candidates
  if (options.includeRandomSuffix) {
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
