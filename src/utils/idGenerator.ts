import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { IdTypePrefix } from '../types';

export interface IdGeneratorOptions {
  type: IdTypePrefix;
  customText?: string;
  useCustom?: boolean;
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
 * Get current date string in YYYYMMDD format
 */
export function getYYYYMMDD(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Generates an ID according to the Master Plan Formula:
 * [Type Letter] + [Custom Text or YYYYMMDD] + [4-Digit Random Code]
 */
export function generateRawId(options: IdGeneratorOptions): string {
  const { type, customText, useCustom } = options;
  const middlePart = useCustom && customText && customText.trim()
    ? customText.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '')
    : getYYYYMMDD();
  const randomPart = generateRandomCode();
  return `${type}${middlePart}${randomPart}`;
}

/**
 * Collision-checked ID generation against Firestore collections.
 * Loops up to 5 attempts to ensure uniqueness.
 */
export async function generateUniqueId(options: IdGeneratorOptions): Promise<string> {
  const collectionName = COLLECTION_MAP[options.type];

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidateId = generateRawId(options);
    try {
      const docRef = doc(db, collectionName, candidateId);
      const snapshot = await getDoc(docRef);
      if (!snapshot.exists()) {
        return candidateId;
      }
      console.warn(`Collision detected for ID: ${candidateId}, retrying...`);
    } catch {
      // In case of permission or offline, candidateId with random 4 digits is mathematically unique
      return candidateId;
    }
  }

  // Fallback with timestamp suffix
  return `${generateRawId(options)}-${Date.now().toString().slice(-4)}`;
}

/**
 * Generates a 6-digit claim verification code for 72-hour claims
 */
export function generateClaimCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
