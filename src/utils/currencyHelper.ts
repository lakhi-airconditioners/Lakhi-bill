// src/utils/currencyHelper.ts

/**
 * Global helper to format all monetary values with exactly 2 decimal places in Indian Rupee format
 * e.g., 41300 -> "₹41,300.00", 35000.5 -> "₹35,000.50"
 */
export function formatCurrency(amount: number | string | undefined | null): string {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount || 0));
  if (isNaN(num)) return '₹0.00';
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format numeric value with 2 decimal places without currency symbol
 * e.g., 41300 -> "41,300.00"
 */
export function formatNumber2Decimals(amount: number | string | undefined | null): string {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount || 0));
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Round a number to 2 decimal places
 */
export function round2(val: number): number {
  if (isNaN(val) || val === undefined || val === null) return 0.00;
  return Math.round((val + Number.EPSILON) * 100) / 100;
}
