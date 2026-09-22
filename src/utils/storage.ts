import { DayRecord, AppSettings, QuarterData, Project, SuggestionTicket, SuggestionStatus } from '../types';
import { getQuarterName, formatDateToYYYYMMDD, createEmptyPunches, getTodayMondayDate } from './timeCalculations';

export const CREATOR_EMAIL = 'reyesabel36@gmail.com';

const STORAGE_KEYS = {
  SETTINGS: 'stt_settings_v2',
  PROJECTS: 'stt_projects_v2',
  USER_EMAIL: 'stt_user_email_v2',
  QUARTERS_PREFIX: 'stt_quarter_',
  ACTIVE_QUARTER: 'stt_active_quarter',
  SAMPLE_SEEDED: 'stt_sample_seeded_v2',
  LAST_SYNC: 'stt_last_sync_v2',
  DEVICE_CLIENT_ID: 'stt_device_client_id_v2',
};

export interface AppUsageStats {
  totalUsers: number;
  totalUniqueDevices: number;
  totalSignedAccounts?: number;
  totalVisits: number;
  totalGiftsSent: number;
  totalGiftsClaimed: number;
  lastUpdated: string;
}

export function isCreator(email?: string): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === CREATOR_EMAIL.toLowerCase();
}

export function isPreviewEnv(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.hostname.includes('run.app') ||
    window.location.hostname.includes('localhost') ||
    window.location.hostname.includes('127.0.0.1')
  );
}

export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(STORAGE_KEYS.DEVICE_CLIENT_ID);
    if (!id) {
      id = 'dev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem(STORAGE_KEYS.DEVICE_CLIENT_ID, id);
    }
    return id;
  } catch {
    return 'dev_' + Date.now();
  }
}

export const DEFAULT_PROJECTS: Project[] = [];

export const SAMPLE_PROJECTS: Project[] = [
  { id: 'proj-sample-1', name: 'Client Operations (sample)', color: '#059669', createdAt: '2026-01-01T00:00:00.000Z', archived: false },
  { id: 'proj-sample-2', name: 'Product Engineering (sample)', color: '#3b82f6', createdAt: '2026-01-01T00:00:00.000Z', archived: false },
  { id: 'proj-sample-3', name: 'Strategy & Ops (sample)', color: '#8b5cf6', createdAt: '2026-01-01T00:00:00.000Z', archived: false },
];

export const DEFAULT_SETTINGS: AppSettings = {
  appTitle: 'Session Time Tracker',
  userName: '',
  userEmail: '',
  themeColor: '#0284C7',
  chartColor: '#0F172A',
  textSize: 'default',
  enableGoals: false,
  enableProjects: true,
  enableStreaks: false,
  showFloatingClockBubble: true,
  weeklyGoalHours: 0,
  dailyGoalHours: 0,
  soundEnabled: true,
  timeFormat24h: false,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch {
    // Storage full or unavailable
  }
}

export function loadUserEmail(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.USER_EMAIL) || '';
  } catch {
    return '';
  }
}

export function saveUserEmail(email: string): void {
  try {
    if (email) {
      localStorage.setItem(STORAGE_KEYS.USER_EMAIL, email.trim().toLowerCase());
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER_EMAIL);
    }
  } catch {
    // Ignore
  }
}

export function loadProjects(includeDeleted: boolean = false): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROJECTS);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return includeDeleted ? parsed : parsed.filter((p) => !p.isDeleted);
  } catch {
    return [];
  }
}

export function mergeProjects(localList: Project[], remoteList: Project[]): Project[] {
  const map = new Map<string, Project>();
  const isSampleFlag = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.SAMPLE_SEEDED) : null;

  localList.forEach((p) => {
    if (p && p.id) {
      if (isSampleFlag === 'false' && (p.id.startsWith('proj-sample-') || p.name?.toLowerCase().includes('(sample)'))) {
        return;
      }
      map.set(p.id, { ...p });
    }
  });

  remoteList.forEach((remoteProj) => {
    if (!remoteProj || !remoteProj.id) return;
    if (isSampleFlag === 'false' && (remoteProj.id.startsWith('proj-sample-') || remoteProj.name?.toLowerCase().includes('(sample)'))) {
      return;
    }
    const localProj = map.get(remoteProj.id);
    if (!localProj) {
      map.set(remoteProj.id, { ...remoteProj });
    } else {
      const localTime = new Date(localProj.deletedAt || localProj.updatedAt || localProj.createdAt || 0).getTime();
      const remoteTime = new Date(remoteProj.deletedAt || remoteProj.updatedAt || remoteProj.createdAt || 0).getTime();
      if (remoteTime >= localTime) {
        map.set(remoteProj.id, { ...localProj, ...remoteProj });
      }
    }
  });

  return Array.from(map.values());
}

export function saveProjects(projects: Project[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
  } catch {
    // Storage full
  }
}

export function addProject(name: string, color: string, client?: string, description?: string): Project {
  const current = loadProjects(true);
  const newProj: Project = {
    id: 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    name: name.trim(),
    color: color || '#059669',
    client: client?.trim() || undefined,
    description: description?.trim() || undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const updated = [...current, newProj];
  saveProjects(updated);
  return newProj;
}

export function updateProject(id: string, updates: Partial<Project>): void {
  const current = loadProjects(true);
  const updated = current.map((p) => {
    if (p.id === id) {
      return { ...p, ...updates, updatedAt: new Date().toISOString() };
    }
    return p;
  });
  saveProjects(updated);
}

export function deleteProject(id: string): void {
  const current = loadProjects(true);
  const updated = current.map((p) => {
    if (p.id === id) {
      return { ...p, isDeleted: true, deletedAt: new Date().toISOString() };
    }
    return p;
  });
  saveProjects(updated);
}

export function hardDeleteProject(id: string): void {
  const current = loadProjects(true);
  const updated = current.filter((p) => p.id !== id);
  saveProjects(updated);
}

export function loadQuarterData(quarterName: string): DayRecord[] {
  try {
    const key = STORAGE_KEYS.QUARTERS_PREFIX + quarterName.replace(/\s+/g, '_');
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveQuarterData(quarterName: string, records: DayRecord[]): void {
  try {
    const key = STORAGE_KEYS.QUARTERS_PREFIX + quarterName.replace(/\s+/g, '_');
    localStorage.setItem(key, JSON.stringify(records));
  } catch {
    // Storage full
  }
}

export function listSavedQuarters(): string[] {
  const quarterSet = new Set<string>();
  
  // Always include the current active quarter based on date
  quarterSet.add(getQuarterName(new Date()));

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEYS.QUARTERS_PREFIX)) {
        const qName = key.replace(STORAGE_KEYS.QUARTERS_PREFIX, '').replace(/_/g, ' ').trim();
        if (qName) {
          quarterSet.add(qName);
        }
      }
    }
  } catch {
    // Ignore
  }

  // Return unique sorted quarters
  return Array.from(quarterSet).sort((a, b) => b.localeCompare(a));
}

export function getActiveQuarterName(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_QUARTER);
    if (saved) return saved;
  } catch {
    // Ignore
  }
  return getQuarterName(new Date());
}

export function setActiveQuarterName(name: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_QUARTER, name);
  } catch {
    // Ignore
  }
}

export function clearAllLocalData(): void {
  try {
    localStorage.clear();
  } catch {
    // Ignore
  }
}

export function mergeQuarterRecords(local: DayRecord[], remote: DayRecord[]): DayRecord[] {
  const dayMap = new Map<string, DayRecord>();
  const isSampleFlag = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.SAMPLE_SEEDED) : null;

  const sanitizePunches = (punches: any[]) => {
    if (!Array.isArray(punches)) return [];
    if (isSampleFlag === 'false') {
      return punches.filter((p) => !isSampleRecordOrPunch(p));
    }
    return punches;
  };

  local.forEach((r) => {
    if (r && r.date) {
      dayMap.set(r.date, { ...r, punches: sanitizePunches(r.punches) });
    }
  });

  remote.forEach((remoteRec) => {
    if (!remoteRec || !remoteRec.date) return;
    const d = remoteRec.date;
    const localRec = dayMap.get(d);

    if (!localRec) {
      dayMap.set(d, { ...remoteRec, punches: sanitizePunches(remoteRec.punches) });
      return;
    }

    const punchMap = new Map<string, any>();

    (localRec.punches || []).forEach((p, idx) => {
      const pKey = p.inTime ? `in_${p.inTime}` : `idx_${idx}`;
      punchMap.set(pKey, { ...p });
    });

    (sanitizePunches(remoteRec.punches) || []).forEach((remoteP, idx) => {
      const pKey = remoteP.inTime ? `in_${remoteP.inTime}` : `idx_${idx}`;
      const existingP = punchMap.get(pKey);
      if (!existingP) {
        punchMap.set(pKey, { ...remoteP });
      } else {
        const mergedOut = remoteP.outTime || existingP.outTime || '';
        const mergedIn = remoteP.inTime || existingP.inTime || '';
        const mergedProjId = remoteP.projectId || existingP.projectId;
        const mergedProjName = remoteP.projectName || existingP.projectName;
        const mergedNote = remoteP.note || existingP.note;
        punchMap.set(pKey, {
          ...existingP,
          ...remoteP,
          inTime: mergedIn,
          outTime: mergedOut,
          projectId: mergedProjId,
          projectName: mergedProjName,
          note: mergedNote,
        });
      }
    });

    const mergedPunches = Array.from(punchMap.values()).sort((a, b) => {
      const aTime = a.inTime || '';
      const bTime = b.inTime || '';
      return aTime.localeCompare(bTime);
    });

    let mergedNotes = remoteRec.notes || localRec.notes || undefined;
    if (remoteRec.notes && localRec.notes && remoteRec.notes !== localRec.notes) {
      if (remoteRec.notes.includes(localRec.notes)) {
        mergedNotes = remoteRec.notes;
      } else if (localRec.notes.includes(remoteRec.notes)) {
        mergedNotes = localRec.notes;
      } else {
        mergedNotes = `${localRec.notes} | ${remoteRec.notes}`;
      }
    }

    dayMap.set(d, {
      ...localRec,
      ...remoteRec,
      punches: mergedPunches,
      notes: mergedNotes,
      primaryProjectId: remoteRec.primaryProjectId || localRec.primaryProjectId,
    });
  });

  return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// Full Cross-Device Cloud Sync via server-side API (with optional PIN / Passphrase)
export async function syncWithServer(
  email: string,
  localQuarters?: Record<string, DayRecord[]>,
  localProjects?: Project[],
  localSettings?: AppSettings
): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!email || !email.includes('@')) {
    return { success: false, error: 'No valid user email for sync' };
  }

  const quartersToSync = localQuarters || (() => {
    const qMap: Record<string, DayRecord[]> = {};
    const quarters = listSavedQuarters();
    for (const q of quarters) {
      qMap[q] = loadQuarterData(q);
    }
    return qMap;
  })();

  const projectsToSync = localProjects || loadProjects(true);
  const settingsToSync = localSettings || loadSettings();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': email.trim().toLowerCase(),
      },
      signal: controller.signal,
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        quarters: quartersToSync,
        projects: projectsToSync,
        settings: settingsToSync,
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Sync API responded with status ${res.status}`);
    }

    const json = await res.json();
    if (json.success && json.data) {
      if (json.data.quarters && typeof json.data.quarters === 'object') {
        for (const [qName, remoteDays] of Object.entries(json.data.quarters)) {
          if (Array.isArray(remoteDays)) {
            const localDays = loadQuarterData(qName);
            const merged = mergeQuarterRecords(localDays, remoteDays as DayRecord[]);
            saveQuarterData(qName, merged);
          }
        }
      }
      if (json.data.projects && Array.isArray(json.data.projects)) {
        const merged = mergeProjects(loadProjects(true), json.data.projects);
        saveProjects(merged);
      }
      if (json.data.settings && typeof json.data.settings === 'object') {
        const currentLocal = loadSettings();
        saveSettings({ ...currentLocal, ...json.data.settings, userEmail: email.trim().toLowerCase() });
      }
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
      return { success: true, data: json.data };
    }
    return { success: false, error: 'Invalid response from sync server' };
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn('Sync server offline or unavailable, continuing in local mode:', err.message);
    return { success: false, error: err.name === 'AbortError' ? 'Sync timed out' : err.message };
  }
}

export async function pullFromServer(
  email: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!email || !email.includes('@')) {
    return { success: false, error: 'No email provided' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch('/api/sync', {
      method: 'GET',
      headers: {
        'x-user-email': email.trim().toLowerCase(),
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Pull API responded with status ${res.status}`);
    }

    const json = await res.json();
    if (json.success && json.data) {
      if (json.data.quarters && typeof json.data.quarters === 'object') {
        for (const [qName, remoteDays] of Object.entries(json.data.quarters)) {
          if (Array.isArray(remoteDays)) {
            const localDays = loadQuarterData(qName);
            const merged = mergeQuarterRecords(localDays, remoteDays as DayRecord[]);
            saveQuarterData(qName, merged);
          }
        }
      }
      if (json.data.projects && Array.isArray(json.data.projects)) {
        const merged = mergeProjects(loadProjects(true), json.data.projects);
        saveProjects(merged);
      }
      if (json.data.settings && typeof json.data.settings === 'object') {
        const currentLocal = loadSettings();
        saveSettings({ ...currentLocal, ...json.data.settings, userEmail: email.trim().toLowerCase() });
      }
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
      return { success: true, data: json.data };
    }
    return { success: false, error: 'Could not fetch cloud data' };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return { success: false, error: err.name === 'AbortError' ? 'Pull timed out' : err.message };
  }
}

// Unified 2-Way Sync
export async function performTwoWaySync(
  email: string
): Promise<{ success: boolean; isOffline?: boolean; data?: any; error?: string }> {
  if (!email || !email.includes('@')) {
    return { success: false, error: 'No email configured' };
  }

  // Push local changes and receive merged cloud state in one atomic step
  const pushRes = await syncWithServer(email);
  if (pushRes.success) {
    return { success: true, data: pushRes.data };
  }

  // If push failed, try pull as fallback
  const pullRes = await pullFromServer(email);
  if (pullRes.success) {
    return { success: true, data: pullRes.data };
  }

  return { success: false, isOffline: true, error: pushRes.error || pullRes.error };
}

export function exportAllDataJSON(): string {
  const exportPayload: {
    version: number;
    exportedAt: string;
    userEmail?: string;
    settings: AppSettings;
    projects: Project[];
    quarters: Record<string, DayRecord[]>;
  } = {
    version: 2,
    exportedAt: new Date().toISOString(),
    userEmail: loadUserEmail(),
    settings: loadSettings(),
    projects: loadProjects(),
    quarters: {},
  };

  const quarters = listSavedQuarters();
  for (const q of quarters) {
    exportPayload.quarters[q] = loadQuarterData(q);
  }

  return JSON.stringify(exportPayload, null, 2);
}

export function importAllDataJSON(jsonStr: string): boolean {
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed.userEmail) {
      saveUserEmail(parsed.userEmail);
    }
    if (parsed.settings) {
      saveSettings(parsed.settings);
    }
    if (parsed.projects && Array.isArray(parsed.projects)) {
      saveProjects(parsed.projects);
    }
    if (parsed.quarters && typeof parsed.quarters === 'object') {
      for (const [qName, records] of Object.entries(parsed.quarters)) {
        if (Array.isArray(records)) {
          saveQuarterData(qName, records as DayRecord[]);
        }
      }
    }
    return true;
  } catch (err) {
    console.error('Failed to import JSON data:', err);
    return false;
  }
}

export function recordGiftClaimed(): void {
  try {
    fetch('/api/stats/gift-claimed', { method: 'POST' }).catch(() => {});
  } catch {
    // Ignore
  }
}

export function recordGiftSent(): void {
  try {
    fetch('/api/stats/gift-sent', { method: 'POST' }).catch(() => {});
  } catch {
    // Ignore
  }
}

export async function fetchGlobalStats(): Promise<AppUsageStats | null> {
  try {
    const res = await fetch('/api/stats');
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Ignore
  }
  return null;
}

export function recordDeviceVisit(clientId?: string): void {
  try {
    const id = clientId || getOrCreateDeviceId();
    fetch('/api/stats/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: id }),
    }).catch(() => {});
  } catch {
    // Ignore
  }
}

export async function submitSuggestion(data: {
  name?: string;
  email?: string;
  category: string;
  message: string;
}): Promise<{
  success: boolean;
  message?: string;
  ticketId?: string;
  error?: string;
  needsActivation?: boolean;
  emailDispatched?: boolean;
}> {
  try {
    const res = await fetch('/api/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();

    // Dual-dispatch: Also trigger direct FormSubmit from browser origin
    try {
      fetch(`https://formsubmit.co/ajax/${encodeURIComponent(CREATOR_EMAIL)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          _subject: `[Change Request ${json.ticketId || ''}] [${data.category}] from ${data.name || 'User'}`,
          _template: 'table',
          _captcha: 'false',
          _replyto: data.email || CREATOR_EMAIL,
          ticket_id: json.ticketId || 'CR-NEW',
          category: data.category,
          name: data.name || 'Anonymous User',
          email: data.email || 'None provided',
          message: data.message,
        }),
      }).then(r => r.json()).then(result => {
        console.log('[Browser FormSubmit Result]:', result);
      }).catch(() => {});
    } catch {
      // Ignore background client dispatch error
    }

    if (res.ok) {
      return {
        success: true,
        message: json.message,
        ticketId: json.ticketId,
        needsActivation: json.needsActivation,
        emailDispatched: json.emailDispatched,
      };
    }
    return { success: false, error: json.error || 'Failed to submit suggestion' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Submission error' };
  }
}

export async function fetchCreatorSuggestions(): Promise<SuggestionTicket[]> {
  try {
    const res = await fetch('/api/suggestions');
    if (res.ok) {
      const json = await res.json();
      return json.suggestions || [];
    }
  } catch {
    // Ignore
  }
  return [];
}

export async function updateCreatorSuggestionStatus(id: string, status: SuggestionStatus, creatorNotes?: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/suggestions/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, creatorNotes }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteCreatorSuggestion(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/suggestions/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}

export function exportSuggestionsToMarkdownFile(suggestions: SuggestionTicket[]): void {
  const lines: string[] = [
    `# Session Time Tracker - Change Requests & Feedback Backlog`,
    `Generated on: ${new Date().toLocaleString()}`,
    `Total Change Requests: ${suggestions.length}`,
    `Destination / Creator: ${CREATOR_EMAIL}`,
    ``,
    `---`,
    ``,
  ];

  suggestions.forEach((sug, idx) => {
    const dateStr = sug.createdAt ? new Date(sug.createdAt).toLocaleString() : 'N/A';
    lines.push(`## ${idx + 1}. [${sug.ticketId || 'CR-NEW'}] ${sug.category} (${sug.status || 'new'})`);
    lines.push(`- **Date**: ${dateStr}`);
    lines.push(`- **Submitter**: ${sug.name || 'Anonymous'} ${sug.email ? `(${sug.email})` : ''}`);
    lines.push(`- **Status**: \`${sug.status || 'new'}\``);
    lines.push(`- **Email Dispatched to Creator**: ${sug.emailDispatched ? 'Yes (Automatic)' : 'Logged to file'}`);
    lines.push(`- **Request**:`);
    lines.push(`  > ${sug.message.replace(/\n/g, '\n  > ')}`);
    if (sug.creatorNotes) {
      lines.push(`- **Creator Plan / Notes**: ${sug.creatorNotes}`);
    }
    lines.push(``);
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Change_Requests_${formatDateToYYYYMMDD(new Date())}.md`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


export function isSampleRecordOrPunch(p: any): boolean {
  if (!p) return false;
  if (p.projectName?.toLowerCase().includes('(sample)')) return true;
  if (p.note?.toLowerCase().includes('(sample)')) return true;
  if (p.projectId?.startsWith('proj-sample-')) return true;
  // Check known sample notes or sample project names
  if (p.note === 'Team sync and client ticket resolution' || p.note === 'Dashboard components and testing') return true;
  if (p.projectName === 'Client Operations (sample)' || p.projectName === 'Product Engineering (sample)' || p.projectName === 'Strategy & Ops (sample)') return true;
  return false;
}

export function isSampleDataActive(records?: DayRecord[]): boolean {
  try {
    const isSeededFlag = localStorage.getItem(STORAGE_KEYS.SAMPLE_SEEDED);
    // If the user explicitly cleared sample data or it is marked false, sample mode is NOT active
    if (isSeededFlag === 'false') {
      return false;
    }
    if (isSeededFlag === 'true') {
      return true;
    }

    // If flag is uninitialized, inspect records and projects
    if (records && records.length > 0) {
      for (const r of records) {
        if (
          r.notes?.toLowerCase().includes('(sample)') ||
          r.notes === 'Productive workday' ||
          r.primaryProjectId?.startsWith('proj-sample-') ||
          (r.punches && r.punches.some(isSampleRecordOrPunch))
        ) {
          return true;
        }
      }
    }
    // Also check if any sample projects are active
    const currentProjs = loadProjects(true);
    if (currentProjs.some((p) => p.id?.startsWith('proj-sample-') || p.name?.toLowerCase().includes('(sample)'))) {
      return true;
    }
  } catch {
    // Ignore
  }
  return false;
}

export function setSampleDataActive(active: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SAMPLE_SEEDED, active ? 'true' : 'false');
  } catch {
    // Ignore
  }
}

export function clearSampleData(quarterName?: string): void {
  setSampleDataActive(false);
  
  // Clean all quarters found in local storage plus current active quarter
  const allQuarters = listSavedQuarters();
  if (quarterName && !allQuarters.includes(quarterName)) {
    allQuarters.push(quarterName);
  }

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('stt_quarter_') || key.startsWith('time_tracker_quarter_'))) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const cleaned = parsed
                .map((d: any) => ({
                  ...d,
                  primaryProjectId: d.primaryProjectId?.startsWith('proj-sample-') ? undefined : d.primaryProjectId,
                  notes:
                    d.notes?.toLowerCase().includes('(sample)') || d.notes === 'Productive workday'
                      ? undefined
                      : d.notes,
                  punches: (d.punches || []).filter((p: any) => !isSampleRecordOrPunch(p)),
                }))
                .filter((d: any) => (d.punches && d.punches.length > 0) || (d.notes && d.notes.trim().length > 0));
              localStorage.setItem(key, JSON.stringify(cleaned));
            }
          } catch {
            // Ignore parse error
          }
        }
      }
    }
  } catch {
    // Ignore
  }

  allQuarters.forEach((qName) => {
    const currentDays = loadQuarterData(qName);
    if (!currentDays || currentDays.length === 0) return;

    // Remove all punches with (sample) flag, sample project IDs, or known sample text
    const cleanedDays = currentDays
      .map((d) => {
        const isSampleDayNote = d.notes?.toLowerCase().includes('(sample)') || d.notes === 'Productive workday';
        const cleanedPunches = (d.punches || []).filter((p) => !isSampleRecordOrPunch(p));
        return {
          ...d,
          primaryProjectId: d.primaryProjectId?.startsWith('proj-sample-') ? undefined : d.primaryProjectId,
          notes: isSampleDayNote ? undefined : d.notes,
          punches: cleanedPunches,
        };
      })
      .filter((d) => (d.punches && d.punches.length > 0) || (d.notes && d.notes.trim().length > 0));

    saveQuarterData(qName, cleanedDays);
  });

  // Clean all sample projects
  const currentProjs = loadProjects(true);
  const cleanedProjs = currentProjs.filter((p) =>
    !p.name.toLowerCase().includes('(sample)') &&
    !p.id.startsWith('proj-sample-')
  );
  saveProjects(cleanedProjs);

  // Clear server cloud sync store if signed in
  const userEmail = loadUserEmail() || loadSettings().userEmail;
  if (userEmail && userEmail.includes('@')) {
    syncWithServer(userEmail).catch(() => {});
  }
}

export function hasUserMadeRealPunches(records?: DayRecord[]): boolean {
  try {
    const dayRecords = records || loadQuarterData(getActiveQuarterName());
    for (const r of dayRecords) {
      if (r.punches && r.punches.length > 0) {
        for (const p of r.punches) {
          if (
            (p.inTime || p.outTime) &&
            !p.projectName?.includes('(sample)') &&
            !p.note?.includes('(sample)') &&
            !p.projectId?.startsWith('proj-sample-')
          ) {
            return true;
          }
        }
      }
    }
  } catch {
    // Ignore
  }
  return false;
}

export function seedSampleData(quarterName?: string): DayRecord[] {
  setSampleDataActive(true);
  const existingProjs = loadProjects(true);
  const mergedProjs = mergeProjects(existingProjs, SAMPLE_PROJECTS);
  saveProjects(mergedProjs);

  const qName = quarterName || getActiveQuarterName();
  const sampleRecords: DayRecord[] = loadQuarterData(qName) || [];
  const today = new Date();

  // Create sample entries for the last 5 days
  for (let i = 4; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = formatDateToYYYYMMDD(d);

    const existingDayIdx = sampleRecords.findIndex((r) => r.date === dateStr);
    const samplePunches = [
      {
        inTime: '09:00:00',
        outTime: '13:00:00',
        projectId: 'proj-sample-1',
        projectName: 'Client Operations (sample)',
        note: 'Team sync and client ticket resolution',
      },
      {
        inTime: '13:45:00',
        outTime: '17:30:00',
        projectId: 'proj-sample-2',
        projectName: 'Product Engineering (sample)',
        note: 'Dashboard components and testing',
      },
    ];

    if (existingDayIdx >= 0) {
      sampleRecords[existingDayIdx].punches = [
        ...(sampleRecords[existingDayIdx].punches || []),
        ...samplePunches,
      ];
    } else {
      sampleRecords.push({
        date: dateStr,
        punches: samplePunches,
        notes: 'Productive workday',
        primaryProjectId: 'proj-sample-1',
      });
    }
  }

  saveQuarterData(qName, sampleRecords);
  return sampleRecords;
}
