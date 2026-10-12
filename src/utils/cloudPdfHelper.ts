import { PdfProviderType } from '../types';

/**
 * Extracts Google Drive file ID from various Drive URL formats or a raw ID string.
 * Supports:
 * - https://drive.google.com/file/d/FILE_ID/view...
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID
 * - https://drive.google.com/file/d/FILE_ID/preview
 * - Raw alphanumeric file ID (20-45 chars without slashes)
 */
export function extractGoogleDriveId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();

  // Format: /file/d/([a-zA-Z0-9_-]+)
  const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) {
    return fileDMatch[1];
  }

  // Format: id=([a-zA-Z0-9_-]+)
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }

  // Format: /d/([a-zA-Z0-9_-]+)
  const dMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch && dMatch[1]) {
    return dMatch[1];
  }

  // If user pasted raw ID directly (alphanumeric, underscores, hyphens, no slashes or queries)
  if (!trimmed.includes('/') && !trimmed.includes('?') && !trimmed.includes(' ') && trimmed.length >= 15) {
    return trimmed;
  }

  return '';
}

/**
 * Given a Google Drive input (either raw ID or view/share URL),
 * generates both standard View Link, Embed Preview Link, and Direct Download Link.
 */
export function buildGoogleDriveLinks(input: string): {
  driveId: string;
  viewLink: string;
  embedLink: string;
  downloadLink: string;
} {
  const driveId = extractGoogleDriveId(input);
  if (!driveId) {
    const rawTrimmed = input.trim();
    return {
      driveId: '',
      viewLink: rawTrimmed,
      embedLink: rawTrimmed,
      downloadLink: rawTrimmed,
    };
  }

  return {
    driveId,
    viewLink: `https://drive.google.com/file/d/${driveId}/view?usp=sharing`,
    embedLink: `https://drive.google.com/file/d/${driveId}/preview`,
    downloadLink: `https://drive.google.com/uc?export=download&id=${driveId}`,
  };
}

/**
 * Given a OneDrive view or share URL, derives the view link and direct download link.
 * For OneDrive / SharePoint, appending download=1 triggers a direct file download.
 */
export function buildOneDriveLinks(input: string): {
  viewLink: string;
  downloadLink: string;
} {
  const trimmed = input.trim();
  if (!trimmed) {
    return { viewLink: '', downloadLink: '' };
  }

  let downloadLink = trimmed;

  if (trimmed.includes('download=1')) {
    downloadLink = trimmed;
  } else if (trimmed.includes('?')) {
    downloadLink = `${trimmed}&download=1`;
  } else {
    downloadLink = `${trimmed}?download=1`;
  }

  return {
    viewLink: trimmed,
    downloadLink,
  };
}

/**
 * Detect provider from an existing URL or string.
 */
export function detectProviderFromUrl(url?: string): PdfProviderType {
  if (!url) return 'none';
  const lower = url.toLowerCase();
  if (lower.includes('drive.google.com') || lower.includes('docs.google.com') || extractGoogleDriveId(url)) {
    return 'google_drive';
  }
  if (lower.includes('1drv.ms') || lower.includes('onedrive.live.com') || lower.includes('sharepoint.com')) {
    return 'onedrive';
  }
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    return 'other';
  }
  return 'none';
}

/**
 * Resolves PDF links from an item with backward-compatibility for legacy pdfLink.
 */
export function resolvePdfLinks(item?: {
  pdfLink?: string;
  pdfProvider?: PdfProviderType;
  pdfDriveId?: string;
  pdfViewLink?: string;
  pdfDownloadLink?: string;
}): {
  hasPdf: boolean;
  provider: PdfProviderType;
  driveId?: string;
  viewLink: string;
  embedLink?: string;
  downloadLink: string;
} {
  if (!item) {
    return {
      hasPdf: false,
      provider: 'none',
      viewLink: '',
      downloadLink: '',
    };
  }

  const rawLink = (item.pdfViewLink || item.pdfLink || '').trim();
  const provider = item.pdfProvider && item.pdfProvider !== 'none'
    ? item.pdfProvider
    : detectProviderFromUrl(rawLink);

  if (provider === 'google_drive') {
    const driveId = item.pdfDriveId || extractGoogleDriveId(rawLink);
    if (driveId) {
      const g = buildGoogleDriveLinks(driveId);
      return {
        hasPdf: true,
        provider: 'google_drive',
        driveId,
        viewLink: g.viewLink,
        embedLink: g.embedLink,
        downloadLink: item.pdfDownloadLink?.trim() || g.downloadLink,
      };
    }
  }

  if (provider === 'onedrive') {
    const o = buildOneDriveLinks(rawLink);
    return {
      hasPdf: !!rawLink,
      provider: 'onedrive',
      viewLink: o.viewLink,
      downloadLink: item.pdfDownloadLink?.trim() || o.downloadLink,
    };
  }

  if (rawLink) {
    return {
      hasPdf: true,
      provider: 'other',
      viewLink: rawLink,
      downloadLink: item.pdfDownloadLink?.trim() || rawLink,
    };
  }

  return {
    hasPdf: false,
    provider: 'none',
    viewLink: '',
    downloadLink: '',
  };
}
