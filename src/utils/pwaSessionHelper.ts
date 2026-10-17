/**
 * Detects if the web application is running as an installed PWA / standalone app
 * vs a standard browser tab.
 */
export const isInstalledWebApp = (): boolean => {
  if (typeof window === 'undefined') return false;

  // Modern standard display-mode: standalone
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  // iOS Safari homescreen standalone flag
  const isIosStandalone = (window.navigator as any).standalone === true;

  // Android TWA or webview referrer
  const isAndroidApp = document.referrer.includes('android-app://');

  return Boolean(isStandalone || isIosStandalone || isAndroidApp);
};

export const PWA_CUSTOMER_STORAGE_KEY = 'lakhi_pwa_customer_session';
export const ACTIVE_72H_CLAIM_STORAGE_KEY = 'lakhi_active_72h_claim';
export const NOTIFICATIONS_READ_STORAGE_KEY = 'lakhi_read_notifications_';

export interface PersistentClaimData {
  code: string;
  name: string;
  phone: string;
  notes?: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Saves customer session into localStorage ONLY if running in an installed web app
 */
export const saveCustomerSessionIfInstalled = (customerId: string) => {
  if (isInstalledWebApp()) {
    try {
      localStorage.setItem(PWA_CUSTOMER_STORAGE_KEY, customerId);
    } catch (e) {
      console.warn('Could not save PWA customer session to localStorage', e);
    }
  }
};

/**
 * Retrieves stored customer session if running in installed app
 */
export const getStoredCustomerSessionIfInstalled = (): string | null => {
  if (isInstalledWebApp()) {
    try {
      return localStorage.getItem(PWA_CUSTOMER_STORAGE_KEY);
    } catch {
      return null;
    }
  }
  return null;
};

/**
 * Clears stored customer session
 */
export const clearCustomerSession = () => {
  try {
    localStorage.removeItem(PWA_CUSTOMER_STORAGE_KEY);
    sessionStorage.removeItem(PWA_CUSTOMER_STORAGE_KEY);
  } catch (e) {
    console.warn('Could not clear customer session', e);
  }
};

/**
 * Persists an active 72-hour claim so refreshing page preserves it
 */
export const saveActiveClaim = (claim: PersistentClaimData) => {
  try {
    localStorage.setItem(ACTIVE_72H_CLAIM_STORAGE_KEY, JSON.stringify(claim));
  } catch (e) {
    console.warn('Could not save active claim to localStorage', e);
  }
};

/**
 * Retrieves the persistent active 72h claim if not expired
 */
export const getActiveClaim = (): PersistentClaimData | null => {
  try {
    const raw = localStorage.getItem(ACTIVE_72H_CLAIM_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistentClaimData;
    // Check if 72 hours have elapsed
    if (new Date(parsed.expiresAt).getTime() < Date.now()) {
      localStorage.removeItem(ACTIVE_72H_CLAIM_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

/**
 * Clears the stored 72-hour claim
 */
export const clearActiveClaim = () => {
  try {
    localStorage.removeItem(ACTIVE_72H_CLAIM_STORAGE_KEY);
  } catch (e) {
    console.warn('Could not clear active claim', e);
  }
};
