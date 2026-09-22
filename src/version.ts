// Application Version Configuration
// Semantic Versioning for Session Time Tracker
export const APP_VERSION = '2.7.1';
export const APP_BUILD_DATE = '2026-08-31';

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

