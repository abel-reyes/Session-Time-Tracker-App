import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Header 
} from './components/Header';
import { 
  PunchClockCard 
} from './components/PunchClockCard';
import { 
  MetricsOverview 
} from './components/MetricsOverview';
import { 
  VisualCharts 
} from './components/VisualCharts';
import { 
  RecentTable 
} from './components/RecentTable';
import { 
  GiftModal 
} from './components/GiftModal';
import { 
  TimesheetDetailModal 
} from './components/TimesheetDetailModal';
import { 
  SettingsModal 
} from './components/SettingsModal';
import { 
  PastDateEntryModal 
} from './components/PastDateEntryModal';
import { 
  ProjectsModal 
} from './components/ProjectsModal';
import { 
  AuthModal 
} from './components/AuthModal';
import { 
  QuarterWeeksModal 
} from './components/QuarterWeeksModal';
import {
  WidgetGuideModal
} from './components/WidgetGuideModal';
import {
  FloatingClockBubble
} from './components/FloatingClockBubble';
import { APP_VERSION, formatPublicationTime } from './version';

import { 
  DayRecord, 
  AppSettings, 
  DashboardMetrics, 
  WeeklyChartData,
  PunchPair,
  Project,
  SyncStatusType
} from './types';
import {
  getQuarterName,
  formatDateToYYYYMMDD,
  formatDateMMDDYYYY,
  formatTime24to12,
  formatTimeToHHMMSS,
  calculateMetrics,
  getWeeklyChartData,
  getQuarterWeeksBreakdown,
  getDurationInSeconds,
  formatSecondsToHHMMSS,
  formatSecondsToHuman,
  getActiveElapsedSeconds,
  splitMultiDaySession,
  generateQuarterCSV,
  deleteSessionFromRecords,
  generateSessionId,
} from './utils/timeCalculations';
import {
  loadSettings,
  saveSettings,
  loadQuarterData,
  saveQuarterData,
  listSavedQuarters,
  loadProjects,
  saveProjects,
  syncWithServer,
  pullFromServer,
  performTwoWaySync,
  recordGiftClaimed,
  isSampleDataActive,
  setSampleDataActive,
  clearSampleData,
  hasUserMadeRealPunches,
  seedSampleData,
  SAMPLE_PROJECTS,
  recordDeviceVisit,
  recordDeletedSession,
  recordDeletedDate,
} from './utils/storage';
import {
  playPunchInSound,
  playPunchOutSound,
  playSuccessChime,
} from './utils/audio';
import { Sparkles, RotateCcw, FlaskConical, AlertTriangle, MessageSquarePlus, RefreshCw, X } from 'lucide-react';
import { ConfirmModal, ConfirmDialogOptions } from './components/ConfirmModal';

export default function App() {
  const [activeQuarter, setActiveQuarter] = useState<string>(() => getQuarterName());
  const [availableQuarters, setAvailableQuarters] = useState<string[]>(() => listSavedQuarters());
  const [records, setRecords] = useState<DayRecord[]>(() => loadQuarterData(getQuarterName()));
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isUpdateAvailable, setIsUpdateAvailable] = useState<boolean>(false);
  const [newPublicationVersion, setNewPublicationVersion] = useState<string | null>(null);
  const [liveElapsedSeconds, setLiveElapsedSeconds] = useState<number>(0);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogOptions | null>(null);
  const initialPublicationRef = useRef<{ version: string; buildId: string; publishedAt: string } | null>(null);

  // Sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatusType>('synced');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | undefined>(undefined);
  const [isSyncRefreshing, setIsSyncRefreshing] = useState<boolean>(false);

  // Modals & View Modes
  const [isGiftModalOpen, setIsGiftModalOpen] = useState<boolean>(false);
  const [isTimesheetModalOpen, setIsTimesheetModalOpen] = useState<boolean>(false);
  const [isQuarterWeeksModalOpen, setIsQuarterWeeksModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'theme' | 'goals' | 'cloud' | 'gift' | 'suggestion' | 'inbox'>('theme');
  const [isPastDateModalOpen, setIsPastDateModalOpen] = useState<boolean>(false);
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isWidgetGuideOpen, setIsWidgetGuideOpen] = useState<boolean>(false);
  const [activeViewTab, setActiveViewTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 640;
      const saved = localStorage.getItem('tracker_active_view_tab');
      if (saved) {
        if (isMobile && saved === 'clock-metrics') return 'clock';
        return saved;
      }
      if (isMobile) return 'clock';
    }
    return 'clock-metrics';
  });
  const [selectedPastDate, setSelectedPastDate] = useState<string>(() => formatDateToYYYYMMDD(new Date()));

  // Tab change handler with localStorage persistence
  const handleTabChange = useCallback((tab: string) => {
    setActiveViewTab(tab);
    if (typeof window !== 'undefined') {
      localStorage.setItem('tracker_active_view_tab', tab);
    }
  }, []);

  // Status toast message
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Reload all local records and settings into React state
  const reloadQuarterData = useCallback(() => {
    const loaded = loadQuarterData(activeQuarter);
    setRecords(loaded || []);
    setAvailableQuarters(listSavedQuarters());
    setProjects(loadProjects());
    setSettings(loadSettings());
  }, [activeQuarter]);

  // Apply text size scaling dynamically across the entire document
  useEffect(() => {
    const size = settings.textSize || 'default';
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-text-size', size);
      const fontSizes: Record<string, string> = {
        default: '16px',
        large: '17.5px',
        larger: '19px',
        largest: '20.5px',
      };
      document.documentElement.style.fontSize = fontSizes[size] || '16px';
    }
  }, [settings.textSize]);

  // Handle URL parameters for gifting a blank slate or setting custom title
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const titleParam = params.get('title');
      const isBlank = params.get('blank') === 'true' || params.get('gift') === 'true';
      if (titleParam || isBlank) {
        setSettings((prev) => {
          const updated: AppSettings = {
            ...prev,
            appTitle: titleParam ? decodeURIComponent(titleParam) : prev.appTitle,
            enableGoals: false,
            weeklyGoalHours: 0,
            dailyGoalHours: 0,
          };
          saveSettings(updated);
          return updated;
        });
        if (isBlank) {
          clearSampleData();
          setProjects([]);
          saveProjects([]);
          recordGiftClaimed();
        }
      }
    }
    // Register anonymous device heartbeat / visit for running total user analytics
    recordDeviceVisit();
  }, []);

  useEffect(() => {
    reloadQuarterData();
  }, [reloadQuarterData]);

  // Push updates to cloud if email is configured & broadcast to other tabs
  const triggerAutoSync = useCallback(async () => {
    // Notify other tabs on same device
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('stt_sync_channel');
        bc.postMessage({ type: 'SYNC_UPDATE' });
        bc.close();
      }
    } catch {
      // Ignore
    }

    if (!settings.userEmail || !settings.userEmail.includes('@')) return;
    setSyncStatus('syncing');
    try {
      const res = await syncWithServer(settings.userEmail);
      if (res.success) {
        setSyncStatus('synced');
        setLastSyncedAt(new Date().toISOString());
        reloadQuarterData();
      } else {
        setSyncStatus('idle');
      }
    } catch {
      setSyncStatus('error');
    }
  }, [settings.userEmail, reloadQuarterData]);

  // Cross-Tab Sync (Same Device): listen for changes made in other tabs or 1-tap launcher icons
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('stt_sync_channel');
        bc.onmessage = (event) => {
          if (event.data?.type === 'SYNC_UPDATE') {
            reloadQuarterData();
          }
        };
      }
    } catch {
      // Ignore
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && (e.key.startsWith('stt_') || e.key.startsWith('time_tracker_'))) {
        reloadQuarterData();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [reloadQuarterData]);

  // Initial & Cross-Device Auto-Sync (When switching to app, window focus, or coming back online)
  useEffect(() => {
    if (!settings.userEmail || !settings.userEmail.includes('@')) return;

    let isSubscribed = true;

    const performSync = async () => {
      if (!isSubscribed) return;
      setSyncStatus('syncing');
      try {
        const res = await performTwoWaySync(settings.userEmail!);
        if (!isSubscribed) return;
        if (res.success) {
          setSyncStatus('synced');
          setLastSyncedAt(new Date().toISOString());
          reloadQuarterData();
        } else if (res.isOffline) {
          setSyncStatus('idle');
        } else {
          setSyncStatus('error');
        }
      } catch {
        if (isSubscribed) setSyncStatus('error');
      }
    };

    // Run initial sync on mount
    performSync();

    // Auto-sync when window gains focus or tab becomes visible (handles phone <-> computer switching)
    const handleFocusOrVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        performSync();
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);
    window.addEventListener('online', handleFocusOrVisible);

    // Periodic background sync every 45 seconds while active
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        performSync();
      }
    }, 45000);

    return () => {
      isSubscribed = false;
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
      window.removeEventListener('online', handleFocusOrVisible);
      clearInterval(interval);
    };
  }, [settings.userEmail, reloadQuarterData]);

  // Check for newly published versions of the app automatically
  useEffect(() => {
    let isSubscribed = true;

    const checkPublishedVersion = async () => {
      try {
        const res = await fetch(`/api/version?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data || !isSubscribed) return;

        // Check if server version differs from currently running bundle's APP_VERSION
        const isClientBundleOutdated = Boolean(data.version && data.version !== APP_VERSION);

        if (!initialPublicationRef.current) {
          initialPublicationRef.current = {
            version: data.version || APP_VERSION,
            buildId: data.buildId || '',
            publishedAt: data.publishedAt || '',
          };

          if (isClientBundleOutdated) {
            setIsUpdateAvailable(true);
            setNewPublicationVersion(data.version || APP_VERSION);
          }
        } else {
          // Compare server build with loaded build
          const isNewBuild =
            isClientBundleOutdated ||
            (data.buildId && data.buildId !== initialPublicationRef.current.buildId) ||
            (data.publishedAt && data.publishedAt !== initialPublicationRef.current.publishedAt) ||
            (data.version && data.version !== initialPublicationRef.current.version);

          if (isNewBuild) {
            setIsUpdateAvailable(true);
            setNewPublicationVersion(data.version || APP_VERSION);
          }
        }
      } catch {
        // Offline or server unreachable
      }
    };

    // Check immediately on mount
    checkPublishedVersion();

    // Check on tab focus / visibility / online
    const handleFocusOrVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        checkPublishedVersion();
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);
    window.addEventListener('online', handleFocusOrVisible);

    // Poll every 20 seconds while open
    const interval = setInterval(checkPublishedVersion, 20000);

    // Listen to service worker controller change
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (isSubscribed) setIsUpdateAvailable(true);
      });
    }

    return () => {
      isSubscribed = false;
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
      window.removeEventListener('online', handleFocusOrVisible);
      clearInterval(interval);
    };
  }, []);

  // Today string
  const todayStr = useMemo(() => formatDateToYYYYMMDD(new Date()), []);

  // Today record
  const todayRecord = useMemo(() => {
    return records.find((r) => r.date === todayStr);
  }, [records, todayStr]);

  // Determine current Punch State (IN vs OUT) dynamically across any number of punch pairs
  // Seamlessly supports overnight shifts and multi-day sessions (e.g. clocked in on Sep 1 at 23:45, continuing into Sep 3)
  const punchState = useMemo(() => {
    // 1. Search through ALL records (newest date first) for an open session (inTime without outTime)
    const sortedRecordsDesc = [...records].sort((a, b) => b.date.localeCompare(a.date));
    
    let activeOpenPunch: PunchPair | null = null;
    let activeRecordDate: string | null = null;
    let activeSlot = -1;

    for (const rec of sortedRecordsDesc) {
      if (rec.punches && Array.isArray(rec.punches)) {
        for (let i = 0; i < rec.punches.length; i++) {
          const p = rec.punches[i];
          if (p.inTime && !p.outTime) {
            activeOpenPunch = p;
            activeRecordDate = p.inDate || rec.date;
            activeSlot = i;
            break;
          }
        }
      }
      if (activeOpenPunch) break;
    }

    if (activeOpenPunch && activeOpenPunch.inTime && activeRecordDate) {
      const isMultiDay = activeRecordDate !== todayStr;
      return {
        isPunchedIn: true,
        activeInTime: activeOpenPunch.inTime,
        activeInDate: activeRecordDate,
        activeProjectId: activeOpenPunch.projectId,
        activeProjectName: activeOpenPunch.projectName,
        activeNote: activeOpenPunch.note,
        lastPunchTime: activeOpenPunch.inTime,
        activeSlotIndex: activeSlot,
        isMultiDay,
      };
    }

    // 2. Otherwise, user is clocked out. Find the most recent punch time
    let lastOutTime: string | null = null;
    for (const rec of sortedRecordsDesc) {
      if (rec.punches && Array.isArray(rec.punches)) {
        for (let i = rec.punches.length - 1; i >= 0; i--) {
          const p = rec.punches[i];
          if (p.outTime || p.inTime) {
            lastOutTime = p.outTime || p.inTime || null;
            break;
          }
        }
      }
      if (lastOutTime) break;
    }

    return {
      isPunchedIn: false,
      activeInTime: null as string | null,
      activeInDate: null as string | null,
      activeProjectId: undefined as string | undefined,
      activeProjectName: undefined as string | undefined,
      activeNote: undefined as string | undefined,
      lastPunchTime: lastOutTime,
      activeSlotIndex: -1,
      isMultiDay: false,
    };
  }, [records, todayStr]);

  // Live timer tick for active session (supports cross-midnight and multi-day sessions)
  useEffect(() => {
    if (!punchState.isPunchedIn || !punchState.activeInTime) {
      setLiveElapsedSeconds(0);
      return;
    }

    const tick = () => {
      const s = getActiveElapsedSeconds(punchState.activeInDate, punchState.activeInTime, new Date());
      setLiveElapsedSeconds(s);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [punchState.isPunchedIn, punchState.activeInTime, punchState.activeInDate]);

  // Dashboard Metrics & Charts calculation
  const metrics: DashboardMetrics = useMemo(() => {
    return calculateMetrics(records, todayStr);
  }, [records, todayStr]);

  const weeklyChartData: WeeklyChartData = useMemo(() => {
    return getWeeklyChartData(records, new Date());
  }, [records]);

  const quarterWeeks = useMemo(() => {
    return getQuarterWeeksBreakdown(records, activeQuarter, liveElapsedSeconds);
  }, [records, activeQuarter, liveElapsedSeconds]);

  // Handle Clock In / Clock Out supporting multi-day journeys, overnight shifts, indefinite sessions, projects, and notes
  const handlePunch = (
    type: 'IN' | 'OUT', 
    customDateStr?: string, 
    customTimeStr?: string,
    projectId?: string,
    note?: string
  ) => {
    const now = new Date();
    const targetDate = customDateStr || formatDateToYYYYMMDD(now);
    const targetTime = customTimeStr || formatTimeToHHMMSS(now);

    const updatedRecords = [...records];
    const activeProj = projects.find((p) => p.id === (projectId || selectedProjectId));

    if (type === 'IN') {
      // Check if there is an active session already open across any records
      if (punchState.isPunchedIn && punchState.activeInTime && punchState.activeInDate) {
        setStatusMessage({
          text: `Active session already in progress (started ${formatDateMMDDYYYY(punchState.activeInDate)} at ${formatTime24to12(punchState.activeInTime)}). Please Clock OUT before clocking IN again.`,
          isError: true,
        });
        return;
      }

      const newSessionId = generateSessionId();

      let recIdx = updatedRecords.findIndex((r) => r.date === targetDate);
      if (recIdx === -1) {
        const newRecord: DayRecord = {
          date: targetDate,
          punches: [
            { 
              inDate: targetDate,
              inTime: targetTime, 
              outTime: '', 
              sessionId: newSessionId,
              projectId: activeProj?.id,
              projectName: activeProj?.name,
              note: note || undefined
            }
          ],
        };
        updatedRecords.push(newRecord);
      } else {
        const currentRecord = { ...updatedRecords[recIdx] };
        const punches: PunchPair[] = currentRecord.punches ? [...currentRecord.punches.map((p) => ({ ...p }))] : [];
        let inserted = false;

        for (let i = 0; i < punches.length; i++) {
          if (!punches[i].inTime) {
            punches[i].inDate = targetDate;
            punches[i].inTime = targetTime;
            punches[i].outTime = '';
            punches[i].sessionId = punches[i].sessionId || newSessionId;
            punches[i].projectId = activeProj?.id;
            punches[i].projectName = activeProj?.name;
            if (note) punches[i].note = note;
            inserted = true;
            break;
          }
        }

        if (!inserted) {
          punches.push({ 
            inDate: targetDate,
            inTime: targetTime, 
            outTime: '',
            sessionId: newSessionId,
            projectId: activeProj?.id,
            projectName: activeProj?.name,
            note: note || undefined
          });
        }

        currentRecord.punches = punches;
        updatedRecords[recIdx] = currentRecord;
      }

      saveQuarterData(activeQuarter, updatedRecords);
      setRecords(updatedRecords);
      triggerAutoSync();

      if (settings.soundEnabled) playPunchInSound();
      setStatusMessage({
        text: `Clocked IN at ${formatTime24to12(targetTime)} for ${formatDateMMDDYYYY(targetDate)}${activeProj ? ` • ${activeProj.name}` : ''}`,
        isError: false,
      });
    } else {
      // CLOCK OUT: Search for any active open punch across all records (newest date first)
      let openRecIdx = -1;
      let openPunchIdx = -1;

      for (let r = updatedRecords.length - 1; r >= 0; r--) {
        const rec = updatedRecords[r];
        if (rec.punches && Array.isArray(rec.punches)) {
          for (let p = 0; p < rec.punches.length; p++) {
            if (rec.punches[p].inTime && !rec.punches[p].outTime) {
              openRecIdx = r;
              openPunchIdx = p;
              break;
            }
          }
        }
        if (openRecIdx !== -1) break;
      }

      if (openRecIdx === -1 || openPunchIdx === -1) {
        setStatusMessage({
          text: `Error: Cannot Clock OUT because no active Clock IN session was found.`,
          isError: true,
        });
        return;
      }

      const openRec = { 
        ...updatedRecords[openRecIdx], 
        punches: [...updatedRecords[openRecIdx].punches.map((p) => ({ ...p }))] 
      };
      const activePunch = { ...openRec.punches[openPunchIdx] };
      const startDate = activePunch.inDate || openRec.date;
      const startTime = activePunch.inTime!;
      const endDate = targetDate;
      const endTime = targetTime;
      const activeProjId = activePunch.projectId || activeProj?.id;
      const activeProjName = activePunch.projectName || activeProj?.name;
      const sessionNote = note || activePunch.note;

      // 1. Same-day Clock Out
      if (startDate === endDate) {
        const durSec = getDurationInSeconds(startTime, endTime, startDate, endDate);
        activePunch.outDate = endDate;
        activePunch.outTime = endTime;
        activePunch.totalSessionSeconds = durSec;
        if (sessionNote) activePunch.note = sessionNote;
        
        openRec.punches[openPunchIdx] = activePunch;
        updatedRecords[openRecIdx] = openRec;

        saveQuarterData(activeQuarter, updatedRecords);
        setRecords(updatedRecords);
        triggerAutoSync();

        if (settings.soundEnabled) playPunchOutSound();
        try {
          confetti({
            particleCount: 35,
            spread: 60,
            origin: { y: 0.8 },
            colors: ['#059669', '#10b981', '#34d399', '#f59e0b'],
          });
        } catch {
          // Ignore
        }

        setStatusMessage({
          text: `Clocked OUT at ${formatTime24to12(endTime)} for ${formatDateMMDDYYYY(startDate)} (Session #${openPunchIdx + 1}: ${formatSecondsToHuman(durSec)})`,
          isError: false,
        });
      } else {
        // 2. Cross-Midnight / Multi-Day Session (e.g. Sep 1 23:45 to Sep 3 12:20)
        // Automatically partition the continuous session across individual days to preserve accurate 24-hr daily limits and charts!
        const segments = splitMultiDaySession(
          startDate,
          startTime,
          endDate,
          endTime,
          activeProjId,
          activeProjName,
          sessionNote
        );

        if (segments.length === 0) {
          setStatusMessage({
            text: `Error: End time (${formatDateMMDDYYYY(endDate)} ${formatTime24to12(endTime)}) cannot be before Start time (${formatDateMMDDYYYY(startDate)} ${formatTime24to12(startTime)}).`,
            isError: true,
          });
          return;
        }

        const totalSessionSec = segments.reduce((sum, s) => sum + s.segmentDuration, 0);

        // Replace the start record's open punch with the first segment
        openRec.punches[openPunchIdx] = segments[0].punch;
        updatedRecords[openRecIdx] = openRec;

        // Allocate subsequent segments across subsequent calendar day records
        for (let i = 1; i < segments.length; i++) {
          const seg = segments[i];
          const existingIdx = updatedRecords.findIndex((r) => r.date === seg.date);
          if (existingIdx >= 0) {
            const existingRec = {
              ...updatedRecords[existingIdx],
              punches: [...(updatedRecords[existingIdx].punches || []).map((p) => ({ ...p }))],
            };
            existingRec.punches.push(seg.punch);
            updatedRecords[existingIdx] = existingRec;
          } else {
            updatedRecords.push({
              date: seg.date,
              punches: [seg.punch],
            });
          }
        }

        // Keep records chronologically sorted
        updatedRecords.sort((a, b) => a.date.localeCompare(b.date));

        saveQuarterData(activeQuarter, updatedRecords);
        setRecords(updatedRecords);
        triggerAutoSync();

        if (settings.soundEnabled) playPunchOutSound();
        try {
          confetti({
            particleCount: 45,
            spread: 70,
            origin: { y: 0.8 },
            colors: ['#059669', '#10b981', '#34d399', '#6366f1'],
          });
        } catch {
          // Ignore
        }

        setStatusMessage({
          text: `Clocked OUT at ${formatTime24to12(endTime)}! Multi-day session (${formatSecondsToHuman(totalSessionSec)}) spanning ${formatDateMMDDYYYY(startDate)} to ${formatDateMMDDYYYY(endDate)} recorded.`,
          isError: false,
        });
      }
    }
  };

  // Handle URL shortcut triggers (e.g. from 1-Tap Home Screen Icons or iOS Shortcuts)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const action = params.get('action');
      if (action === 'punch-in' || action === 'clock-in') {
        if (!punchState.isPunchedIn) {
          handlePunch('IN');
        } else {
          setStatusMessage({
            text: 'Already Clocked IN.',
            isError: false,
          });
        }
        // Clean URL to prevent re-triggering on manual browser refresh
        window.history.replaceState({}, '', window.location.pathname);
      } else if (action === 'punch-out' || action === 'clock-out') {
        if (punchState.isPunchedIn) {
          handlePunch('OUT');
        } else {
          setStatusMessage({
            text: 'Already Clocked OUT.',
            isError: false,
          });
        }
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [punchState.isPunchedIn]);

  const handleExportCSV = () => {
    const csvContent = generateQuarterCSV(activeQuarter, records, projects);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Quarter_${activeQuarter.replace(/\s+/g, '_')}_Summary_${todayStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSaveTimesheetRecords = (updated: DayRecord[]) => {
    const nowIso = new Date().toISOString();
    const stamped = updated.map((r) => ({ ...r, updatedAt: r.updatedAt || nowIso }));
    saveQuarterData(activeQuarter, stamped);
    setRecords(stamped);
    triggerAutoSync();
    if (settings.soundEnabled) playSuccessChime();
  };

  const handleSaveDayRecord = (record: DayRecord) => {
    const nowIso = new Date().toISOString();
    const stamped = { ...record, updatedAt: nowIso };
    setRecords((prev) => {
      const updated = [...prev];
      const idx = updated.findIndex((r) => r.date === record.date);
      if (idx >= 0) {
        updated[idx] = stamped;
      } else {
        updated.push(stamped);
      }
      saveQuarterData(activeQuarter, updated);
      triggerAutoSync();
      return updated;
    });
    if (settings.soundEnabled) playSuccessChime();
  };

  const handleSaveMultipleRecords = (recordsToSave: DayRecord[]) => {
    const nowIso = new Date().toISOString();
    setRecords((prev) => {
      const updated = [...prev];
      for (const rec of recordsToSave) {
        const stamped = { ...rec, updatedAt: nowIso };
        const idx = updated.findIndex((r) => r.date === rec.date);
        if (idx >= 0) {
          updated[idx] = stamped;
        } else {
          updated.push(stamped);
        }
      }
      updated.sort((a, b) => a.date.localeCompare(b.date));
      saveQuarterData(activeQuarter, updated);
      triggerAutoSync();
      return updated;
    });
    if (settings.soundEnabled) playSuccessChime();
  };

  const handleUpdateTodaySessions = (updatedPunches: PunchPair[]) => {
    const nowIso = new Date().toISOString();
    setRecords((prev) => {
      const updated = [...prev];
      const idx = updated.findIndex((r) => r.date === todayStr);
      if (idx >= 0) {
        updated[idx] = {
          ...updated[idx],
          punches: updatedPunches,
          updatedAt: nowIso,
        };
      } else {
        updated.push({
          date: todayStr,
          punches: updatedPunches,
          updatedAt: nowIso,
        });
      }
      saveQuarterData(activeQuarter, updated);
      triggerAutoSync();
      return updated;
    });
    if (settings.soundEnabled) playSuccessChime();
  };

  // Comprehensive, atomic session deletion supporting both single-day and multi-day sessions
  const handleDeleteSession = useCallback((dateStr: string, punch: PunchPair, punchIndex?: number) => {
    // Record tombstones for this punch session and any multi-day identifiers
    recordDeletedSession(punch, dateStr);

    setRecords((prevRecords) => {
      const updated = deleteSessionFromRecords(prevRecords, dateStr, punch, punchIndex);
      saveQuarterData(activeQuarter, updated);
      triggerAutoSync();
      return updated;
    });
    if (settings.soundEnabled) playSuccessChime();
    setStatusMessage({
      text: punch.isMultiDaySegment || punch.sessionId
        ? 'Multi-day session removed across all dates and synced.'
        : 'Session removed successfully and synced.',
      isError: false,
    });
  }, [activeQuarter, triggerAutoSync, settings.soundEnabled]);

  // Cancel / discard an in-progress active Clock In session
  const handleDiscardActiveSession = useCallback(() => {
    const nowIso = new Date().toISOString();
    setRecords((prev) => {
      const updated = [...prev];
      let found = false;
      for (let r = updated.length - 1; r >= 0; r--) {
        const rec = updated[r];
        if (rec.punches && Array.isArray(rec.punches)) {
          const target = rec.punches.find((p) => p.inTime && (!p.outTime || p.outTime.trim() === ''));
          if (target) {
            recordDeletedSession(target, rec.date);
          }
          const remaining = rec.punches.filter((p) => !(p.inTime && (!p.outTime || p.outTime.trim() === '')));
          if (remaining.length !== rec.punches.length) {
            updated[r] = { ...rec, punches: remaining, updatedAt: nowIso };
            found = true;
            break;
          }
        }
      }
      if (found) {
        saveQuarterData(activeQuarter, updated);
        triggerAutoSync();
        if (settings.soundEnabled) playPunchOutSound();
        setStatusMessage({
          text: 'Active session discarded and deleted.',
          isError: false,
        });
      }
      return updated;
    });
  }, [activeQuarter, triggerAutoSync, settings.soundEnabled]);

  const handleSaveSettings = (updated: AppSettings) => {
    setSettings(updated);
    saveSettings(updated);
    triggerAutoSync();
  };

  const handleSaveProjects = (updatedProjects: Project[]) => {
    setProjects(updatedProjects);
    saveProjects(updatedProjects);
    triggerAutoSync();
    if (settings.soundEnabled) playSuccessChime();
  };

  const handleLoginWithEmail = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    setSyncStatus('syncing');
    try {
      const res = await performTwoWaySync(cleanEmail);
      if (res.success) {
        const updatedSettings = { ...settings, userEmail: cleanEmail };
        setSettings(updatedSettings);
        saveSettings(updatedSettings);
        setSyncStatus('synced');
        setLastSyncedAt(new Date().toISOString());
        reloadQuarterData();
        setStatusMessage({
          text: `Connected cross-device sync as ${cleanEmail}.`,
          isError: false,
        });
        return { success: true };
      } else {
        const updatedSettings = { ...settings, userEmail: cleanEmail };
        setSettings(updatedSettings);
        saveSettings(updatedSettings);
        setSyncStatus('synced');
        setStatusMessage({
          text: `Connected cross-device sync as ${cleanEmail}.`,
          isError: false,
        });
        return { success: true };
      }
    } catch (err: any) {
      setSyncStatus('error');
      return { success: false, error: err.message || 'Failed to connect to sync server' };
    }
  };

  const handleLogout = () => {
    const updated = { ...settings, userEmail: undefined };
    setSettings(updated);
    saveSettings(updated);
    setSyncStatus('idle');
    setStatusMessage({
      text: 'Disconnected from cloud sync. Data stored locally on this device.',
      isError: false,
    });
  };

  const applyAppUpdateAndReload = async () => {
    setIsSyncRefreshing(true);
    setStatusMessage({ text: 'Applying newest publication & refreshing app...', isError: false });

    // 1. Sync data first if signed in
    if (settings.userEmail && settings.userEmail.includes('@')) {
      try {
        await performTwoWaySync(settings.userEmail);
      } catch {
        // Continue to reload
      }
    }

    // 2. Clear Service Worker & Browser Caches
    if (typeof window !== 'undefined') {
      try {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            if (reg.active) {
              reg.active.postMessage({ type: 'CLEAR_CACHE' });
              reg.active.postMessage({ type: 'SKIP_WAITING' });
            }
            await reg.update().catch(() => {});
          }
        }
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {
        // Caches cleanup handled
      }

      // 3. Force fresh reload
      setTimeout(() => {
        window.location.reload();
      }, 150);
    }
  };

  const handleSyncAndRefresh = async () => {
    setIsSyncRefreshing(true);
    try {
      let syncCompleted = false;
      let syncIsOffline = false;
      let publishedVersion: string | null = null;
      let isNewPublicationDetected = false;

      // 1. Query server version with no-cache header to verify newest publication
      try {
        const verRes = await fetch(`/api/version?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' },
        });
        if (verRes.ok) {
          const verData = await verRes.json();
          if (verData?.version) {
            publishedVersion = verData.version;
          }
          if (initialPublicationRef.current && verData) {
            if (
              (verData.buildId && verData.buildId !== initialPublicationRef.current.buildId) ||
              (verData.publishedAt && verData.publishedAt !== initialPublicationRef.current.publishedAt) ||
              (verData.version && verData.version !== initialPublicationRef.current.version)
            ) {
              isNewPublicationDetected = true;
            }
          }
        }
      } catch {
        // Fallback silently if offline
      }

      // If a new publication version is detected OR if update banner is active, apply the update and reload immediately!
      if (isNewPublicationDetected || isUpdateAvailable) {
        await applyAppUpdateAndReload();
        return;
      }

      // 2. Sync data with cloud server if user is logged in
      if (settings.userEmail && settings.userEmail.includes('@')) {
        setSyncStatus('syncing');
        const syncRes = await performTwoWaySync(settings.userEmail);
        if (syncRes.success) {
          syncCompleted = true;
          setSyncStatus('synced');
          setLastSyncedAt(new Date().toISOString());
        } else if (syncRes.isOffline) {
          syncIsOffline = true;
          setSyncStatus('idle');
        } else {
          setSyncStatus('error');
        }
      }

      // 3. Check and update Service Worker registrations
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            await reg.update();
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          }
        } catch {
          // SW update check handled silently
        }
      }

      // 4. Reload local quarter data, settings, and project collections into React state
      reloadQuarterData();

      // 5. Broadcast to any other open tabs
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel('stt_sync_channel');
          bc.postMessage({ type: 'SYNC_UPDATE' });
          bc.close();
        }
      } catch {
        // Ignore
      }

      if (settings.userEmail && settings.userEmail.includes('@')) {
        if (syncCompleted) {
          setStatusMessage({
            text: publishedVersion 
              ? `Connected & synced with latest publication (v${publishedVersion}).`
              : 'Cloud sync complete: All punches, projects, and settings are up to date.',
            isError: false,
          });
        } else if (syncIsOffline) {
          setStatusMessage({
            text: 'Operating offline: Local records & cache refreshed.',
            isError: false,
          });
        } else {
          setStatusMessage({
            text: 'Local records refreshed. Cloud server unreachable.',
            isError: true,
          });
        }
      } else {
        setStatusMessage({
          text: publishedVersion 
            ? `Refreshed to latest publication (v${publishedVersion}).` 
            : 'App refreshed & records reloaded.',
          isError: false,
        });
      }
    } catch {
      reloadQuarterData();
      setSyncStatus('error');
      setStatusMessage({
        text: 'Refresh completed with local records.',
        isError: false,
      });
    } finally {
      setTimeout(() => {
        setIsSyncRefreshing(false);
      }, 400);
    }
  };

  const isSampleActive = useMemo(() => isSampleDataActive(records), [records]);
  const hasRealPunches = useMemo(() => hasUserMadeRealPunches(records), [records]);

  const handleSeedSampleBanner = () => {
    setConfirmDialog({
      title: 'Seed Sample Work Sessions?',
      message: 'This will populate This Week and Last Week with sample sessions flagged as (sample) for full chart comparisons. You can clear sample sessions anytime without losing any of your real personal entries.',
      confirmText: 'Seed Sample Data',
      variant: 'primary',
      onConfirm: () => {
        seedSampleData(activeQuarter);
        setProjects(loadProjects());
        reloadQuarterData();
        setStatusMessage({
          text: '🧪 Sample sessions seeded with (sample) flags.',
          isError: false,
        });
      },
    });
  };

  const handleClearSampleBanner = () => {
    setConfirmDialog({
      title: 'Clear Sample Sessions?',
      message: 'ONLY sample sessions flagged with (sample) will be removed. Your real personal punches, custom projects, and settings will remain completely intact.',
      confirmText: 'Clear Sample Data',
      variant: 'warning',
      onConfirm: () => {
        clearSampleData(activeQuarter);
        setProjects(loadProjects());
        reloadQuarterData();
        setStatusMessage({
          text: 'Sample sessions removed successfully. Your personal records are preserved.',
          isError: false,
        });
      },
    });
  };

  const handleOpenDateEditor = (dateStr: string) => {
    setSelectedPastDate(dateStr);
    setIsPastDateModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Header Bar */}
      <Header
        appTitle={settings.appTitle || 'Session Time Tracker'}
        onUpdateAppTitle={(newTitle) => {
          const updated = { ...settings, appTitle: newTitle };
          setSettings(updated);
          saveSettings(updated);
          triggerAutoSync();
        }}
        activeQuarter={activeQuarter}
        onQuarterChange={(q) => setActiveQuarter(q)}
        availableQuarters={availableQuarters}
        userEmail={settings.userEmail}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        onSyncRefresh={handleSyncAndRefresh}
        isSyncRefreshing={isSyncRefreshing}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenProjectsModal={() => setIsProjectsModalOpen(true)}
        onOpenQuarterWeeksModal={() => setIsQuarterWeeksModalOpen(true)}
        onOpenSettingsModal={() => {
          setSettingsInitialTab('theme');
          setIsSettingsModalOpen(true);
        }}
        onOpenTimesheetModal={() => setIsTimesheetModalOpen(true)}
        isPunchedIn={punchState.isPunchedIn}
        activeTab={activeViewTab}
        onTabChange={handleTabChange}
        themeColor={settings.themeColor || '#0284C7'}
      />

      {/* Update Available Banner */}
      {isUpdateAvailable && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs sm:text-sm shadow-md animate-fadeIn shrink-0">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-200 shrink-0" />
              <span className="font-semibold">New publication version available {newPublicationVersion ? `(v${newPublicationVersion})` : ''}.</span>
              <span className="text-emerald-100 hidden sm:inline">Refresh to load latest changes instantly.</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={applyAppUpdateAndReload}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-white text-emerald-800 hover:bg-emerald-50 shadow-2xs transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Update Now</span>
              </button>
              <button
                type="button"
                onClick={() => setIsUpdateAvailable(false)}
                className="p-1 rounded-md text-emerald-200 hover:text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                title="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Banner for Test Mode or Initial Seed Onboarding */}
      {isSampleActive ? (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 sm:py-3 text-amber-950 shadow-xs animate-fadeIn">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <span className="inline-flex items-center gap-1 font-extrabold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300 shrink-0">
                <FlaskConical className="w-3 h-3 text-amber-800" />
                Sample Mode Active
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
              <button
                type="button"
                onClick={handleClearSampleBanner}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-950 bg-amber-200/90 hover:bg-amber-300 border border-amber-400/60 shadow-2xs transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-800" />
                <span>Clear Sample Data</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-900 hover:bg-amber-100/80 transition-colors cursor-pointer"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                <span>Suggestions</span>
              </button>
            </div>
          </div>
        </div>
      ) : !hasRealPunches ? (
        <div className="bg-emerald-50/80 border-b border-emerald-200/80 px-4 py-2.5 text-emerald-950 shadow-xs animate-fadeIn">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 border border-emerald-300 shrink-0">
                <Sparkles className="w-3 h-3 text-emerald-700" />
                Quick Preview
              </span>
            </div>

            <button
              type="button"
              onClick={handleSeedSampleBanner}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 shadow-2xs transition-colors cursor-pointer shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Seed Sample Data</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-5 space-y-5">
        {/* 1. Clock Buttons Section */}
        {(activeViewTab === 'clock' || activeViewTab === 'clock-metrics' || activeViewTab !== 'recent') && (
          <section 
            aria-label="Clock In and Clock Out Controls"
            className={activeViewTab === 'metrics' ? 'hidden sm:block' : 'block'}
          >
            <PunchClockCard
              todayRecord={todayRecord}
              projects={projects}
              selectedProjectId={selectedProjectId}
              onSelectProject={(projId) => setSelectedProjectId(projId)}
              onOpenProjectsModal={() => setIsProjectsModalOpen(true)}
              onPunch={handlePunch}
              onUpdateTodaySessions={handleUpdateTodaySessions}
              isPunchedIn={punchState.isPunchedIn}
              activeInTime={punchState.activeInTime}
              activeInDate={punchState.activeInDate}
              isMultiDay={punchState.isMultiDay}
              lastPunchTime={punchState.lastPunchTime}
              statusMessage={statusMessage}
              onDismissStatus={() => setStatusMessage(null)}
              themeColor={settings.themeColor || '#0284C7'}
              secondaryColor={settings.chartColor || '#0F172A'}
              onOpenPastDateModal={() => {
                setSelectedPastDate(formatDateToYYYYMMDD(new Date()));
                setIsPastDateModalOpen(true);
              }}
            />
          </section>
        )}

        {/* 2. Key Performance Stats & 3. Visual Charts (Metrics) */}
        {(activeViewTab === 'metrics' || activeViewTab === 'clock-metrics' || (activeViewTab !== 'recent' && activeViewTab !== 'clock')) && (
          <>
            <section 
              aria-label="Work Statistics and Metrics"
              className={activeViewTab === 'clock' ? 'hidden sm:block' : 'block'}
            >
              <MetricsOverview
                metrics={metrics}
                settings={settings}
                liveExtraSeconds={liveElapsedSeconds}
                records={records}
                projects={projects}
                activeQuarter={activeQuarter}
                themeColor={settings.themeColor || '#0284C7'}
                secondaryColor={settings.chartColor || '#0F172A'}
                onOpenQuarterWeeksModal={() => setIsQuarterWeeksModalOpen(true)}
              />
            </section>

            <section 
              aria-label="Performance and Shift Analytics"
              className={activeViewTab === 'clock' ? 'hidden sm:block' : 'block'}
            >
              <VisualCharts
                chartData={weeklyChartData}
                records={records}
                dailyGoalHours={settings.dailyGoalHours}
                enableGoals={settings.enableGoals !== false}
                chartColor={settings.chartColor || '#0F172A'}
                themeColor={settings.themeColor || '#0284C7'}
              />
            </section>
          </>
        )}

        {/* 4. Recent Shift History & Master Table Access */}
        {(activeViewTab === 'recent') && (
          <section aria-label="Recent Session History" className="animate-fadeIn">
            <RecentTable
              recentEntries={metrics.recent}
              onOpenTimesheetModal={() => setIsTimesheetModalOpen(true)}
              onExportCSV={handleExportCSV}
              onEditDay={handleOpenDateEditor}
              activeQuarter={activeQuarter}
              projects={projects}
              themeColor={settings.themeColor || '#0284C7'}
              secondaryColor={settings.chartColor || '#0F172A'}
            />
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white/70 py-4 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            <strong>Session Time Tracker</strong> &bull; Cross-Device Sync &bull; Projects & Objectives &bull; Indefinite Sessions &bull; Google Sheets Compatible
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsProjectsModalOpen(true)}
              className="text-slate-600 hover:text-slate-900 hover:underline font-medium cursor-pointer"
            >
              Projects ({projects.length})
            </button>
            <span>&bull;</span>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="text-slate-600 hover:text-slate-900 hover:underline font-medium cursor-pointer"
            >
              {settings.userEmail ? `Synced (${settings.userEmail})` : 'Email Sync'}
            </button>
            <span>&bull;</span>
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="text-slate-600 hover:text-slate-900 hover:underline font-medium cursor-pointer"
            >
              Settings
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <ProjectsModal
        isOpen={isProjectsModalOpen}
        onClose={() => setIsProjectsModalOpen(false)}
        projects={projects}
        records={records}
        onSaveProjects={handleSaveProjects}
        onSaveRecords={handleSaveTimesheetRecords}
        themeColor={settings.themeColor || '#0284C7'}
        secondaryColor={settings.chartColor || '#0F172A'}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        userEmail={settings.userEmail || ''}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        onLoginWithEmail={handleLoginWithEmail}
        onLogout={handleLogout}
        onManualSync={triggerAutoSync}
        themeColor={settings.themeColor || '#0284C7'}
      />

      <GiftModal
        isOpen={isGiftModalOpen}
        onClose={() => setIsGiftModalOpen(false)}
        currentSettings={settings}
        themeColor={settings.themeColor || '#0284C7'}
        onApplyGiftConfig={(newTitle) => {
          const updated: AppSettings = {
            ...settings,
            appTitle: newTitle,
            enableGoals: false,
            weeklyGoalHours: 0,
            dailyGoalHours: 0,
          };
          setSettings(updated);
          saveSettings(updated);
          setProjects([]);
          saveProjects([]);
          reloadQuarterData();
        }}
      />

      <TimesheetDetailModal
        isOpen={isTimesheetModalOpen}
        onClose={() => setIsTimesheetModalOpen(false)}
        quarterName={activeQuarter}
        records={records}
        projects={projects}
        onSaveRecords={handleSaveTimesheetRecords}
        onSaveProjects={handleSaveProjects}
        onExportCSV={handleExportCSV}
        onOpenDateEditor={handleOpenDateEditor}
        themeColor={settings.themeColor || '#0284C7'}
      />

      <QuarterWeeksModal
        isOpen={isQuarterWeeksModalOpen}
        onClose={() => setIsQuarterWeeksModalOpen(false)}
        quarterName={activeQuarter}
        weeks={quarterWeeks}
        weeklyGoalHours={settings.weeklyGoalHours || 0}
        themeColor={settings.themeColor || '#0284C7'}
        secondaryColor={settings.chartColor || '#0F172A'}
        records={records}
        projects={projects}
        liveExtraSeconds={liveElapsedSeconds}
      />

      <PastDateEntryModal
        isOpen={isPastDateModalOpen}
        onClose={() => setIsPastDateModalOpen(false)}
        initialDate={selectedPastDate}
        records={records}
        projects={projects}
        onSaveDayRecord={handleSaveDayRecord}
        onSaveMultipleRecords={handleSaveMultipleRecords}
        onDeleteSession={handleDeleteSession}
        themeColor={settings.themeColor || '#0284C7'}
        secondaryColor={settings.chartColor || '#0F172A'}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        onDataReload={reloadQuarterData}
        onOpenGiftModal={() => setIsGiftModalOpen(true)}
        onOpenWidgetGuide={() => setIsWidgetGuideOpen(true)}
        onSyncRefresh={handleSyncAndRefresh}
        initialTab={settingsInitialTab}
      />

      <WidgetGuideModal
        isOpen={isWidgetGuideOpen}
        onClose={() => setIsWidgetGuideOpen(false)}
        themeColor={settings.themeColor || '#0284C7'}
      />

      {/* Persistent Floating Clock Bubble Prototype (Active when enabled in Settings and not on the primary Clock In/Out tab or combined Clock & Metrics tab) */}
      {settings.showFloatingClockBubble !== false && activeViewTab !== 'clock' && activeViewTab !== 'clock-metrics' && (
        <FloatingClockBubble
          todayRecord={todayRecord}
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSelectProject={(projId) => setSelectedProjectId(projId)}
          onPunch={handlePunch}
          isPunchedIn={punchState.isPunchedIn}
          activeInTime={punchState.activeInTime}
          activeInDate={punchState.activeInDate}
          isMultiDay={punchState.isMultiDay}
          lastPunchTime={punchState.lastPunchTime}
          themeColor={settings.themeColor || '#0284C7'}
          secondaryColor={settings.chartColor || '#0F172A'}
          onNavigateToClockTab={() => handleTabChange('clock')}
        />
      )}
      {/* Confirmation Dialog */}
      <ConfirmModal
        options={confirmDialog}
        onClose={() => setConfirmDialog(null)}
        themeColor={settings.themeColor || '#0284C7'}
      />
    </div>
  );
}
