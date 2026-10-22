// Application Version Configuration
// Semantic Versioning for Session Time Tracker
export const APP_VERSION = '2.10.9';
export const APP_BUILD_DATE = '2026-10-22';
export const APP_BUILD_ID = '2.10.9-20261022';

/**
 * Compares two semantic version strings (e.g., '2.10.8' vs '2.10.7').
 * Returns true if remote is strictly greater than current.
 */
export function isNewerVersion(remote?: string, current: string = APP_VERSION): boolean {
  if (!remote || !current) return false;
  if (remote === current) return false;

  const rParts = remote.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const cParts = current.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const maxLen = Math.max(rParts.length, cParts.length);

  for (let i = 0; i < maxLen; i++) {
    const r = rParts[i] ?? 0;
    const c = cParts[i] ?? 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
}

/**
 * Formats an ISO publication timestamp into a human-readable string.
 * e.g., "Aug 30, 2026, 2:00 AM"
 */
export function formatPublicationTime(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

