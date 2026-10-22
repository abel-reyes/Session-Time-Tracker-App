import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  Save, 
  X, 
  Check, 
  History, 
  AlertCircle,
  FolderKanban,
  FileText,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  Layers
} from 'lucide-react';
import { DayRecord, PunchPair, Project } from '../types';
import { 
  formatDateToYYYYMMDD, 
  formatDateMMDDYYYY,
  getDurationInSeconds, 
  formatSecondsToHuman,
  formatSecondsToHHMMSS,
  calculateDayTotalSeconds,
  splitMultiDaySession,
  generateSessionId,
  normalizeTimeToHHMMSS,
  getQuarterName,
  getQuarterNameFromDateStr
} from '../utils/timeCalculations';
import { recordDeletedSession, loadQuarterData } from '../utils/storage';
import { ProjectBadge } from './ProjectBadge';
import { ConfirmModal, ConfirmDialogOptions } from './ConfirmModal';

interface StagedDayData {
  punches: PunchPair[];
  notes: string;
  isDirty: boolean;
  initialPunches: PunchPair[];
  initialNotes: string;
}

interface PastDateEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
  records: DayRecord[];
  projects?: Project[];
  onSaveDayRecord: (updatedRecord: DayRecord) => void;
  onSaveMultipleRecords?: (records: DayRecord[]) => void;
  onDeleteSession?: (dateStr: string, punch: PunchPair, punchIndex?: number) => void;
  themeColor?: string;
  secondaryColor?: string;
}

/**
 * Calculates a date string offset by N days from a base date string.
 * Uses explicit year, month, and day integers to avoid timezone drift and browser parsing inconsistencies.
 */
function getOffsetDateStr(baseDateStr?: string | null, offsetDays: number = 0): string {
  if (!baseDateStr || typeof baseDateStr !== 'string') {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + offsetDays);
    return formatDateToYYYYMMDD(fallback);
  }
  const clean = baseDateStr.trim();
  const parts = clean.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + offsetDays);
    return formatDateToYYYYMMDD(fallback);
  }
  const d = new Date(parts[0], parts[1] - 1, parts[2] + offsetDays);
  if (isNaN(d.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + offsetDays);
    return formatDateToYYYYMMDD(fallback);
  }
  return formatDateToYYYYMMDD(d);
}

/**
 * Safely extracts short weekday name (e.g. "Mon", "Tue").
 */
function getDayOfWeekName(dateStr?: string | null): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  try {
    const parts = dateStr.trim().split('-').map(Number);
    if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
      return '';
    }
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  } catch {
    return '';
  }
}

export function PastDateEntryModal({
  isOpen,
  onClose,
  initialDate,
  records = [],
  projects = [],
  onSaveDayRecord,
  onSaveMultipleRecords,
  onDeleteSession,
  themeColor = '#0284C7',
  secondaryColor = '#0F172A',
}: PastDateEntryModalProps) {
  // Currently active date in the single-day editor
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate.trim())) return initialDate.trim();
    return formatDateToYYYYMMDD(new Date());
  });

  // Entry mode: 'single' (focused date) or 'batch' (bulk add across multiple missed dates)
  const [entryMode, setEntryMode] = useState<'single' | 'batch'>('single');

  // Staged multi-day data dictionary: holds edits for all dates touched in this session
  const [stagedDays, setStagedDays] = useState<Record<string, StagedDayData>>({});

  // Form input fields for adding a session
  // DEFAULT: Clock Out Date ALWAYS defaults to selectedDate (Same Day)
  const [newEndDate, setNewEndDate] = useState<string>(() => {
    if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate.trim())) return initialDate.trim();
    return formatDateToYYYYMMDD(new Date());
  });
  const [newInTime, setNewInTime] = useState<string>('09:00:00');
  const [newOutTime, setNewOutTime] = useState<string>('17:00:00');
  const [newProjectId, setNewProjectId] = useState<string>(projects[0]?.id || '');
  const [newNote, setNewNote] = useState<string>('');

  // Batch entry state
  const [batchSelectedDates, setBatchSelectedDates] = useState<string[]>([]);
  const [batchIsOvernight, setBatchIsOvernight] = useState<boolean>(false);

  // Status and feedback
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogOptions | null>(null);

  // Lifecycle refs to prevent accidental resets when parent re-renders or records sync
  const isOpenRef = useRef(false);
  const lastInitialDateRef = useRef<string | undefined>(undefined);
  const recordsRef = useRef(records);
  recordsRef.current = records;

  const selectedDateQuarter = getQuarterNameFromDateStr(selectedDate);
  const currentQuarter = getQuarterName();
  const isClosedQuarter = selectedDateQuarter !== currentQuarter;

  // Helper to load initial data for any date from records or quarter storage
  const loadInitialDayData = useCallback((dateStr: string): { punches: PunchPair[]; notes: string } => {
    const currentRecs = recordsRef.current || [];
    let rec = currentRecs.find((r) => r && r.date === dateStr);
    if (!rec) {
      try {
        const qName = getQuarterNameFromDateStr(dateStr);
        const qRecs = loadQuarterData(qName);
        rec = qRecs?.find((r) => r && r.date === dateStr);
      } catch (err) {
        console.warn('Could not load quarter data for date:', dateStr, err);
      }
    }
    if (rec && rec.punches && Array.isArray(rec.punches)) {
      const activePairs = rec.punches
        .filter((p) => p && Boolean((p.inTime && String(p.inTime).trim()) || (p.outTime && String(p.outTime).trim())))
        .map((p) => ({ ...p }));
      return {
        punches: activePairs,
        notes: rec.notes || '',
      };
    }
    return { punches: [], notes: '' };
  }, []);

  // Stabilized modal open effect: only initializes when modal actually opens or initialDate changes upon opening
  useEffect(() => {
    if (isOpen) {
      const shouldInit = !isOpenRef.current || (initialDate && initialDate !== lastInitialDateRef.current);
      if (shouldInit) {
        isOpenRef.current = true;
        lastInitialDateRef.current = initialDate;

        const initial = initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate.trim())
          ? initialDate.trim()
          : formatDateToYYYYMMDD(new Date());

        setSelectedDate(initial);
        setNewEndDate(initial); // Guaranteed Same Day default
        setEntryMode('single');
        setBatchSelectedDates([]);
        setBatchIsOvernight(false);
        setSuccessNotice(null);
        setFormError(null);
        setSaveSuccess(false);

        const initData = loadInitialDayData(initial);
        setStagedDays({
          [initial]: {
            punches: initData.punches,
            notes: initData.notes,
            isDirty: false,
            initialPunches: initData.punches.map((p) => ({ ...p })),
            initialNotes: initData.notes,
          },
        });
      }
    } else {
      isOpenRef.current = false;
    }
  }, [isOpen, initialDate, loadInitialDayData]);

  // Handle switching date: PRESERVES all staged edits and updates newEndDate to Same Day default
  const handleDateChange = useCallback((newDate: string) => {
    if (!newDate || typeof newDate !== 'string') return;
    const clean = newDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return;

    setSelectedDate(clean);
    setNewEndDate(clean); // Reset end date to Same Day on date switch
    setFormError(null);

    setStagedDays((prev) => {
      if (prev[clean]) return prev;
      const initData = loadInitialDayData(clean);
      return {
        ...prev,
        [clean]: {
          punches: initData.punches,
          notes: initData.notes,
          isDirty: false,
          initialPunches: initData.punches.map((p) => ({ ...p })),
          initialNotes: initData.notes,
        },
      };
    });
  }, [loadInitialDayData]);

  // Get active day data safely
  const currentDayData: StagedDayData = useMemo(() => {
    if (stagedDays[selectedDate]) {
      return stagedDays[selectedDate];
    }
    const initData = loadInitialDayData(selectedDate);
    return {
      punches: initData.punches,
      notes: initData.notes,
      isDirty: false,
      initialPunches: initData.punches.map((p) => ({ ...p })),
      initialNotes: initData.notes,
    };
  }, [stagedDays, selectedDate, loadInitialDayData]);

  const currentPunches = currentDayData.punches;
  const dayNotes = currentDayData.notes;

  // List of all dates that currently have unsaved changes in staging
  const dirtyDates = useMemo(() => {
    return Object.keys(stagedDays).filter((d) => stagedDays[d]?.isDirty);
  }, [stagedDays]);

  // Total seconds across all dirty/modified days
  const totalModifiedSec = useMemo(() => {
    return dirtyDates.reduce((acc, d) => {
      return acc + calculateDayTotalSeconds(stagedDays[d]?.punches || []);
    }, 0);
  }, [dirtyDates, stagedDays]);

  // Generate candidate dates for quick selection in batch mode (last 14 days)
  const recentCandidateDates = useMemo(() => {
    const today = formatDateToYYYYMMDD(new Date());
    const result: { dateStr: string; label: string; weekday: string }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = getOffsetDateStr(today, -i);
      result.push({
        dateStr: d,
        label: formatDateMMDDYYYY(d),
        weekday: getDayOfWeekName(d),
      });
    }
    return result;
  }, []);

  // Efficient memoized lookup for punch counts on candidate dates without repeated storage calls
  const candidatePunchesCount = useMemo(() => {
    const map: Record<string, number> = {};
    for (const { dateStr } of recentCandidateDates) {
      if (stagedDays[dateStr]?.punches) {
        map[dateStr] = stagedDays[dateStr].punches.length;
      } else {
        const rec = records.find((r) => r && r.date === dateStr);
        if (rec && rec.punches) {
          map[dateStr] = rec.punches.filter((p) => p && Boolean(p.inTime || p.outTime)).length;
        } else {
          map[dateStr] = 0;
        }
      }
    }
    return map;
  }, [recentCandidateDates, stagedDays, records]);

  // Clock Out Date helpers for single day mode
  const nextDayStr = getOffsetDateStr(selectedDate, 1);
  const isSameDay = newEndDate === selectedDate;
  const isNextDay = newEndDate === nextDayStr;
  const isCustomDate = !isSameDay && !isNextDay;

  // Update punches for the currently selected date (immutable)
  const updateCurrentDayPunches = (newPunches: PunchPair[]) => {
    setStagedDays((prev) => {
      const existing = prev[selectedDate] || loadInitialDayData(selectedDate);
      return {
        ...prev,
        [selectedDate]: {
          punches: newPunches,
          notes: existing.notes || '',
          isDirty: true,
          initialPunches: existing.initialPunches || [],
          initialNotes: existing.initialNotes || '',
        },
      };
    });
  };

  // Update notes for the currently selected date (immutable)
  const updateCurrentDayNotes = (newNotes: string) => {
    setStagedDays((prev) => {
      const existing = prev[selectedDate] || loadInitialDayData(selectedDate);
      return {
        ...prev,
        [selectedDate]: {
          punches: existing.punches || [],
          notes: newNotes,
          isDirty: true,
          initialPunches: existing.initialPunches || [],
          initialNotes: existing.initialNotes || '',
        },
      };
    });
  };

  // Revert changes for a specific date back to its original state
  const handleRevertDate = (dateStr: string) => {
    setStagedDays((prev) => {
      const day = prev[dateStr];
      if (!day) return prev;
      return {
        ...prev,
        [dateStr]: {
          punches: day.initialPunches.map((p) => ({ ...p })),
          notes: day.initialNotes,
          isDirty: false,
          initialPunches: day.initialPunches,
          initialNotes: day.initialNotes,
        },
      };
    });
    setSuccessNotice(`Reverted changes for ${formatDateMMDDYYYY(dateStr)}.`);
    setTimeout(() => setSuccessNotice(null), 2500);
  };

  // Discard all unsaved changes across all dates
  const handleRevertAll = () => {
    setStagedDays((prev) => {
      const next: Record<string, StagedDayData> = {};
      for (const d of Object.keys(prev)) {
        const val = prev[d];
        if (!val) continue;
        next[d] = {
          punches: val.initialPunches.map((p) => ({ ...p })),
          notes: val.initialNotes,
          isDirty: false,
          initialPunches: val.initialPunches,
          initialNotes: val.initialNotes,
        };
      }
      return next;
    });
    setSuccessNotice('Discarded all unsaved modifications.');
    setTimeout(() => setSuccessNotice(null), 2500);
  };

  // Add session in Single Day mode
  const handleAddSession = () => {
    setFormError(null);
    if (!newInTime || !newInTime.trim()) {
      setFormError('Please provide a Start (Clock In) time.');
      return;
    }

    const formattedIn = normalizeTimeToHHMMSS(newInTime.trim());
    const formattedOut = newOutTime && newOutTime.trim() ? normalizeTimeToHHMMSS(newOutTime.trim()) : '';
    if (!formattedIn) {
      setFormError('Invalid Start time format.');
      return;
    }

    const matchProj = projects.find((p) => p.id === newProjectId);

    if (newEndDate > selectedDate) {
      if (!formattedOut) {
        setFormError('Please provide an End (Clock Out) time for overnight and multi-day sessions.');
        return;
      }
      const dur = getDurationInSeconds(formattedIn, formattedOut, selectedDate, newEndDate);
      if (dur <= 0) {
        setFormError('End date/time must be strictly after Start date/time.');
        return;
      }

      const executeMultiDayAdd = () => {
        const segments = splitMultiDaySession(
          selectedDate,
          formattedIn,
          newEndDate,
          formattedOut,
          newProjectId || undefined,
          matchProj?.name,
          newNote.trim() || undefined
        );

        if (!segments || segments.length === 0) {
          setFormError('Could not process this session time range. Please verify start and end times.');
          return;
        }

        // Stage Day 1 and subsequent segments across their dates
        setStagedDays((prev) => {
          const next = { ...prev };
          for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            const dStr = seg.date;
            const existing = next[dStr] || {
              ...loadInitialDayData(dStr),
              isDirty: false,
              initialPunches: loadInitialDayData(dStr).punches.map((p) => ({ ...p })),
              initialNotes: loadInitialDayData(dStr).notes,
            };
            next[dStr] = {
              ...existing,
              punches: [...existing.punches, seg.punch],
              isDirty: true,
            };
          }
          return next;
        });

        setNewNote('');
        setSuccessNotice(`Added multi-day session spanning ${segments.length} days.`);
        setTimeout(() => setSuccessNotice(null), 2500);
      };

      if (isClosedQuarter) {
        setConfirmDialog({
          title: 'Add Multi-Day Session to Closed Quarter?',
          message: `This session starts on ${formatDateMMDDYYYY(selectedDate)} in closed quarter "${selectedDateQuarter}". Are you sure you want to add punches to this archived quarter?`,
          confirmText: `Confirm & Add to ${selectedDateQuarter}`,
          cancelText: 'Cancel',
          variant: 'warning',
          onConfirm: () => {
            setConfirmDialog(null);
            executeMultiDayAdd();
          },
        });
        return;
      }

      executeMultiDayAdd();
    } else {
      if (formattedOut) {
        const dur = getDurationInSeconds(formattedIn, formattedOut);
        if (dur <= 0) {
          setFormError('End time must be after Start time.');
          return;
        }
      }

      const executeSameDayAdd = () => {
        const newPunch: PunchPair = {
          inDate: selectedDate,
          inTime: formattedIn,
          outDate: selectedDate,
          outTime: formattedOut,
          sessionId: generateSessionId(),
          projectId: newProjectId || undefined,
          projectName: matchProj?.name,
          note: newNote.trim() || undefined,
        };

        updateCurrentDayPunches([...currentPunches, newPunch]);
        setNewNote('');
        setSuccessNotice(`Session added to ${formatDateMMDDYYYY(selectedDate)}.`);
        setTimeout(() => setSuccessNotice(null), 2000);
      };

      if (isClosedQuarter) {
        setConfirmDialog({
          title: 'Add Punch to Closed Quarter?',
          message: `${formatDateMMDDYYYY(selectedDate)} belongs to closed quarter "${selectedDateQuarter}". Are you sure you want to add punches to this archived quarter?`,
          confirmText: `Confirm & Add to ${selectedDateQuarter}`,
          cancelText: 'Cancel',
          variant: 'warning',
          onConfirm: () => {
            setConfirmDialog(null);
            executeSameDayAdd();
          },
        });
        return;
      }

      executeSameDayAdd();
    }
  };

  // Add session in Bulk Batch mode across multiple missed days
  const handleBatchAddSessions = () => {
    setFormError(null);
    if (batchSelectedDates.length === 0) {
      setFormError('Please select at least one missed date to apply sessions to.');
      return;
    }
    if (!newInTime || !newInTime.trim()) {
      setFormError('Please specify Clock In (Start) time.');
      return;
    }
    if (!newOutTime || !newOutTime.trim()) {
      setFormError('Please specify Clock Out (End) time.');
      return;
    }

    const formattedIn = normalizeTimeToHHMMSS(newInTime.trim());
    const formattedOut = normalizeTimeToHHMMSS(newOutTime.trim());
    if (!formattedIn || !formattedOut) {
      setFormError('Please provide valid start and end times.');
      return;
    }

    if (!batchIsOvernight) {
      const dur = getDurationInSeconds(formattedIn, formattedOut);
      if (dur <= 0) {
        setFormError('Clock Out time must be after Clock In time for same-day shifts.');
        return;
      }
    }

    const matchProj = projects.find((p) => p.id === newProjectId);

    const executeBatchAdd = () => {
      setStagedDays((prev) => {
        const next = { ...prev };
        for (const dateStr of batchSelectedDates) {
          const existing = next[dateStr] || {
            ...loadInitialDayData(dateStr),
            isDirty: false,
            initialPunches: loadInitialDayData(dateStr).punches.map((p) => ({ ...p })),
            initialNotes: loadInitialDayData(dateStr).notes,
          };

          const endDateStr = batchIsOvernight ? getOffsetDateStr(dateStr, 1) : dateStr;
          const punch: PunchPair = {
            inDate: dateStr,
            inTime: formattedIn,
            outDate: endDateStr,
            outTime: formattedOut,
            sessionId: generateSessionId(),
            projectId: newProjectId || undefined,
            projectName: matchProj?.name,
            note: newNote.trim() || undefined,
          };

          next[dateStr] = {
            ...existing,
            punches: [...existing.punches, punch],
            isDirty: true,
          };
        }
        return next;
      });

      // Switch to the first modified date to view it immediately
      if (batchSelectedDates.length > 0) {
        setSelectedDate(batchSelectedDates[0]);
        setNewEndDate(batchSelectedDates[0]);
      }

      setSuccessNotice(`Added ${newInTime.slice(0, 5)} – ${newOutTime.slice(0, 5)} to all ${batchSelectedDates.length} selected days. Click "Save All" when ready.`);
      setEntryMode('single');
      setTimeout(() => setSuccessNotice(null), 3500);
    };

    // Check if any batch dates belong to a closed quarter
    const closedBatchDates = batchSelectedDates.filter(
      (d) => getQuarterNameFromDateStr(d) !== currentQuarter
    );
    if (closedBatchDates.length > 0) {
      const closedNames = Array.from(new Set(closedBatchDates.map((d) => getQuarterNameFromDateStr(d)))).join(', ');
      setConfirmDialog({
        title: 'Batch Add to Closed Quarter?',
        message: `${closedBatchDates.length} of the selected dates belong to archived quarter (${closedNames}). Are you sure you want to add punches to closed quarters?`,
        confirmText: `Confirm & Batch Add`,
        cancelText: 'Cancel',
        variant: 'warning',
        onConfirm: () => {
          setConfirmDialog(null);
          executeBatchAdd();
        },
      });
      return;
    }

    executeBatchAdd();
  };

  // Remove session from current date safely
  const handleRemoveSession = (index: number) => {
    const targetPunch = currentPunches[index];
    if (!targetPunch) return;

    recordDeletedSession(targetPunch, selectedDate);
    if (onDeleteSession) {
      try {
        onDeleteSession(selectedDate, targetPunch, index);
      } catch (err) {
        console.warn('onDeleteSession error:', err);
      }
    }

    const updated = currentPunches.filter((_, i) => i !== index);
    updateCurrentDayPunches(updated);
  };

  // Save all staged changes (or current date)
  const handleSaveAll = (shouldClose: boolean = true) => {
    setFormError(null);
    const targetDates = dirtyDates.length > 0 ? dirtyDates : [selectedDate];

    const recordsToSave: DayRecord[] = targetDates.map((dStr) => {
      const data = stagedDays[dStr] || loadInitialDayData(dStr);
      const cleanPunches = (data.punches || []).filter(
        (p) => p && Boolean((p.inTime && String(p.inTime).trim()) || (p.outTime && String(p.outTime).trim()))
      );
      return {
        date: dStr,
        punches: cleanPunches,
        notes: data.notes?.trim() || undefined,
        updatedAt: new Date().toISOString(),
      };
    });

    // Check closed quarters
    const closedDates = recordsToSave.filter(
      (r) => getQuarterNameFromDateStr(r.date) !== currentQuarter
    );

    const executeSave = () => {
      if (onSaveMultipleRecords) {
        onSaveMultipleRecords(recordsToSave);
      } else {
        recordsToSave.forEach((r) => onSaveDayRecord(r));
      }

      // Clear dirty flags in local state
      setStagedDays((prev) => {
        const next = { ...prev };
        for (const d of targetDates) {
          if (next[d]) {
            next[d] = {
              ...next[d],
              isDirty: false,
              initialPunches: next[d].punches.map((p) => ({ ...p })),
              initialNotes: next[d].notes,
            };
          }
        }
        return next;
      });

      setSaveSuccess(true);
      setSuccessNotice(`Successfully saved changes for ${recordsToSave.length} ${recordsToSave.length === 1 ? 'day' : 'days'}.`);

      if (shouldClose) {
        setTimeout(() => {
          setSaveSuccess(false);
          onClose();
        }, 500);
      } else {
        setTimeout(() => {
          setSaveSuccess(false);
          setSuccessNotice(null);
        }, 2500);
      }
    };

    if (closedDates.length > 0) {
      const closedNames = Array.from(new Set(closedDates.map((r) => getQuarterNameFromDateStr(r.date)))).join(', ');
      setConfirmDialog({
        title: 'Save Punches to Closed Quarter?',
        message: `You are saving modifications to ${closedDates.length} date(s) belonging to archived quarter "${closedNames}". Are you sure you want to proceed?`,
        confirmText: `Confirm & Save to ${closedNames}`,
        cancelText: 'Cancel',
        variant: 'warning',
        onConfirm: () => {
          setConfirmDialog(null);
          executeSave();
        },
      });
      return;
    }

    executeSave();
  };

  const dayTotalSec = calculateDayTotalSeconds(currentPunches);
  const newSessionSec = (newInTime && newOutTime) 
    ? getDurationInSeconds(newInTime, newOutTime, selectedDate, newEndDate) 
    : 0;

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[94dvh] sm:max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-xs shrink-0"
              style={{ backgroundColor: themeColor }}
            >
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Log & Edit Past Sessions
                </h3>
                {dirtyDates.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    {dirtyDates.length} {dirtyDates.length === 1 ? 'day' : 'days'} staged
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Correct past logs, add missed punches, or batch apply hours across multiple days
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto text-xs text-slate-700">
          {/* Notification banner */}
          {successNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-900 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{successNotice}</span>
            </div>
          )}

          {/* Staged Modifications Bar */}
          {dirtyDates.length > 0 && (
            <div className="p-3 bg-teal-50/90 border border-teal-200/90 rounded-xl space-y-2 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-bold text-teal-950">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  Staged Edits Across {dirtyDates.length} {dirtyDates.length === 1 ? 'Day' : 'Days'} ({formatSecondsToHuman(totalModifiedSec)} total):
                </span>
                <button
                  type="button"
                  onClick={handleRevertAll}
                  className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                  title="Discard all unsaved edits across all days"
                >
                  <RotateCcw className="w-3 h-3" />
                  Discard All
                </button>
              </div>

              {/* Day chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {dirtyDates.map((dateStr) => {
                  const isCurrent = dateStr === selectedDate;
                  const count = stagedDays[dateStr]?.punches?.length || 0;
                  const sec = calculateDayTotalSeconds(stagedDays[dateStr]?.punches || []);

                  return (
                    <div
                      key={dateStr}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all ${
                        isCurrent
                          ? 'bg-teal-700 text-white font-bold ring-2 ring-teal-500/40 shadow-xs'
                          : 'bg-white border border-teal-200 text-teal-900 hover:bg-teal-100/70'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleDateChange(dateStr)}
                        className="cursor-pointer flex items-center gap-1 text-left"
                        title="Click to view & adjust this date"
                      >
                        <span>{getDayOfWeekName(dateStr)}, {formatDateMMDDYYYY(dateStr)}</span>
                        <span className={`text-[10px] font-mono ${isCurrent ? 'text-teal-200' : 'text-slate-500'}`}>
                          ({count} {count === 1 ? 'session' : 'sessions'} • {formatSecondsToHuman(sec)})
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRevertDate(dateStr);
                        }}
                        className={`p-0.5 rounded hover:bg-rose-100 hover:text-rose-700 transition-colors cursor-pointer ${
                          isCurrent ? 'text-teal-200 hover:text-rose-200 hover:bg-teal-800' : 'text-slate-400'
                        }`}
                        title="Revert changes for this day"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mode Switcher: Single Day vs Bulk Add Missed Punches */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setEntryMode('single')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                entryMode === 'single'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" style={{ color: themeColor }} />
              <span>Single Day Editor ({formatDateMMDDYYYY(selectedDate)})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEntryMode('batch');
                if (batchSelectedDates.length === 0) {
                  const today = formatDateToYYYYMMDD(new Date());
                  const d1 = getOffsetDateStr(today, -1);
                  const d2 = getOffsetDateStr(today, -2);
                  const d3 = getOffsetDateStr(today, -3);
                  setBatchSelectedDates([d3, d2, d1]);
                }
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                entryMode === 'batch'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" style={{ color: themeColor }} />
              <span>Bulk Add Missed Punches</span>
            </button>
          </div>

          {/* View: SINGLE DAY CONTROLS */}
          {entryMode === 'single' && (
            <>
              {/* Choose Date: Date picker + Prev/Next buttons */}
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <label 
                    htmlFor="past-entry-date-picker"
                    className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Calendar className="w-4 h-4" style={{ color: themeColor }} />
                    Choose Date:
                  </label>

                  <div className="flex items-center gap-1.5 flex-1 sm:max-w-xs">
                    <button
                      type="button"
                      onClick={() => handleDateChange(getOffsetDateStr(selectedDate, -1))}
                      className="p-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                      title="Previous Day"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <input
                      id="past-entry-date-picker"
                      type="date"
                      value={selectedDate}
                      onChange={(e) => handleDateChange(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none cursor-pointer shadow-2xs text-center"
                    />

                    <button
                      type="button"
                      onClick={() => handleDateChange(getOffsetDateStr(selectedDate, 1))}
                      className="p-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                      title="Next Day"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Closed Quarter Warning Banner */}
              {isClosedQuarter && (
                <div className="p-3 bg-amber-50 border border-amber-200/90 rounded-xl flex items-start gap-2.5 text-xs text-amber-950 shadow-2xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Closed Quarter Notice ({selectedDateQuarter}):</span>{' '}
                    <span className="text-amber-800">
                      {formatDateMMDDYYYY(selectedDate)} belongs to closed quarter {selectedDateQuarter}. Manually adding or editing punches here requires explicit confirmation.
                    </span>
                  </div>
                </div>
              )}

              {/* Existing Sessions for selected date */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" style={{ color: themeColor }} />
                    Existing Sessions: {currentPunches.length}
                  </span>
                  <span className="text-xs font-bold font-mono text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                    Day Total: {formatSecondsToHHMMSS(dayTotalSec)} ({formatSecondsToHuman(dayTotalSec)})
                  </span>
                </div>

                {currentPunches.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center text-slate-400 italic">
                    No working sessions logged for {getDayOfWeekName(selectedDate)}, {formatDateMMDDYYYY(selectedDate)} yet. Use the form below to add one!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {currentPunches.map((punch, idx) => {
                      const pMatch = projects.find((p) => p.id === punch.projectId) || (punch.projectName ? { name: punch.projectName, color: '#6366f1' } : null);

                      return (
                        <div
                          key={punch.sessionId || idx}
                          className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2"
                        >
                          {/* Top row: session number, retroactive project selector, delete button */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="w-6 h-6 rounded-full bg-slate-100 font-bold text-[11px] text-slate-600 flex items-center justify-center shrink-0">
                                #{idx + 1}
                              </span>
                              {pMatch && (
                                <ProjectBadge
                                  name={pMatch.name}
                                  color={pMatch.color}
                                  size="sm"
                                />
                              )}
                              {/* Retroactive project change dropdown */}
                              <div className="flex items-center gap-1">
                                <FolderKanban className="w-3 h-3 text-slate-400" />
                                <select
                                  value={punch.projectId || ''}
                                  onChange={(e) => {
                                    const selectedProj = projects.find((p) => p.id === e.target.value);
                                    const updated = currentPunches.map((p, i) => i === idx ? {
                                      ...p,
                                      projectId: e.target.value || undefined,
                                      projectName: selectedProj?.name,
                                    } : p);
                                    updateCurrentDayPunches(updated);
                                  }}
                                  className="text-[11px] font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md px-2 py-0.5 focus:bg-white focus:outline-none cursor-pointer"
                                  title="Assign or change project retroactively"
                                >
                                  <option value="">General / Unassigned</option>
                                  {projects.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveSession(idx)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1 text-xs"
                              title="Delete this session pair"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              <span className="text-[11px] text-rose-600 font-semibold hidden sm:inline">Delete</span>
                            </button>
                          </div>

                          {/* Start / Stop times */}
                          <div className="flex items-center gap-1.5 font-mono text-xs">
                            <input
                              type="time"
                              step="1"
                              value={punch.inTime || ''}
                              onChange={(e) => {
                                const updated = currentPunches.map((p, i) => i === idx ? { ...p, inTime: e.target.value } : p);
                                updateCurrentDayPunches(updated);
                              }}
                              className="border border-slate-200 rounded px-2 py-1 bg-slate-50 focus:bg-white text-emerald-800 font-semibold cursor-pointer"
                            />
                            <span className="text-slate-400">to</span>
                            <input
                              type="time"
                              step="1"
                              value={punch.outTime || ''}
                              onChange={(e) => {
                                const updated = currentPunches.map((p, i) => i === idx ? { ...p, outTime: e.target.value } : p);
                                updateCurrentDayPunches(updated);
                              }}
                              className="border border-slate-200 rounded px-2 py-1 bg-slate-50 focus:bg-white text-rose-800 font-semibold cursor-pointer"
                            />
                          </div>

                          {/* Note annotation */}
                          <div className="pt-0.5">
                            <input
                              type="text"
                              placeholder="Add session note or accomplished objective..."
                              value={punch.note || ''}
                              onChange={(e) => {
                                const updated = currentPunches.map((p, i) => i === idx ? { ...p, note: e.target.value } : p);
                                updateCurrentDayPunches(updated);
                              }}
                              className="w-full text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:bg-white focus:outline-none"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add a New Session to Selected Day */}
              <div className="bg-teal-50/50 rounded-xl p-4 border border-teal-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-900 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-teal-700" />
                    Add Session to: {formatDateMMDDYYYY(selectedDate)}
                  </span>
                  {newSessionSec > 0 && (
                    <span className="text-[11px] font-semibold text-teal-800 font-mono">
                      + {formatSecondsToHuman(newSessionSec)} session
                    </span>
                  )}
                </div>

                {/* Time inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                      Clock In (Start) Time
                    </label>
                    <input
                      type="time"
                      step="1"
                      value={newInTime}
                      onChange={(e) => {
                        setNewInTime(e.target.value);
                        setFormError(null);
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono focus:outline-teal-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                      Clock Out (End) Time
                    </label>
                    <input
                      type="time"
                      step="1"
                      value={newOutTime}
                      onChange={(e) => {
                        setNewOutTime(e.target.value);
                        setFormError(null);
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono focus:outline-teal-600 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Clock Out Date selector - DEFAULTS TO SAME DAY */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white/80 p-2.5 rounded-lg border border-teal-200/80">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                    <span>Clock Out Date:</span>
                    {isSameDay ? (
                      <span className="text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                        Same Day ({formatDateMMDDYYYY(selectedDate)})
                      </span>
                    ) : isNextDay ? (
                      <span className="text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                        +1 Day ({formatDateMMDDYYYY(newEndDate)})
                      </span>
                    ) : (
                      <span className="text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                        Multi-Day ({formatDateMMDDYYYY(newEndDate)})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setNewEndDate(selectedDate)}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        isSameDay 
                          ? 'bg-teal-700 text-white shadow-xs' 
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {isSameDay && <Check className="w-3 h-3" />}
                      Same Day
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewEndDate(nextDayStr)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                        isNextDay 
                          ? 'bg-indigo-600 text-white shadow-xs font-bold' 
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {isNextDay && <Check className="w-3 h-3" />}
                      +1 Day (Overnight)
                    </button>

                    <input
                      type="date"
                      min={selectedDate}
                      value={newEndDate}
                      onChange={(e) => {
                        if (e.target.value) {
                          setNewEndDate(e.target.value);
                        }
                      }}
                      className={`bg-white border rounded px-2 py-0.5 text-[11px] font-mono font-semibold cursor-pointer ${
                        isCustomDate ? 'border-purple-500 text-purple-900 bg-purple-50' : 'border-slate-300 text-slate-800'
                      }`}
                      title="Or pick a custom end date"
                    />
                  </div>
                </div>

                {/* Project selection & Note */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                      Project
                    </label>
                    <select
                      value={newProjectId}
                      onChange={(e) => setNewProjectId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-teal-600"
                    >
                      <option value="">General / Unassigned</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                      Session Note / Objective
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Completed client presentation..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-teal-600"
                    />
                  </div>
                </div>

                {formError && (
                  <div className="flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAddSession}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-teal-900 bg-teal-200/80 hover:bg-teal-300 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Session to List</span>
                  </button>
                </div>
              </div>

              {/* Overall Day Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" style={{ color: secondaryColor }} />
                  Overall Daily Notes & Objectives Summary for {formatDateMMDDYYYY(selectedDate)}
                </label>
                <textarea
                  rows={2}
                  placeholder="Summary of all objectives accomplished for this date..."
                  value={dayNotes}
                  onChange={(e) => updateCurrentDayNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-300 rounded-xl focus:outline-none"
                />
              </div>
            </>
          )}

          {/* View: BULK ADD MISSED PUNCHES */}
          {entryMode === 'batch' && (
            <div className="bg-slate-50/70 rounded-xl p-4 sm:p-5 border border-slate-200 space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4" style={{ color: themeColor }} />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Bulk Add Missed Punches
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Select the dates below to stage standard work hours across all of them at once.
                </p>
              </div>

              {/* Interactive Candidate Date Grid (Last 14 days) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                  <span>Select Missed Dates ({batchSelectedDates.length} selected):</span>
                  {batchSelectedDates.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setBatchSelectedDates([])}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-44 overflow-y-auto p-1 bg-white rounded-xl border border-slate-200">
                  {recentCandidateDates.map(({ dateStr, label, weekday }) => {
                    const isSelected = batchSelectedDates.includes(dateStr);
                    const existingCount = candidatePunchesCount[dateStr] || 0;
                    const hasExisting = existingCount > 0;

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => {
                          setBatchSelectedDates((prev) => 
                            isSelected ? prev.filter((d) => d !== dateStr) : [...prev, dateStr].sort()
                          );
                        }}
                        className={`p-2 rounded-lg text-left transition-all border text-xs cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-slate-800 border-slate-900 text-white shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[11px]">{weekday}</span>
                          <span className={`text-[10px] px-1 rounded ${
                            isSelected ? 'bg-slate-700 text-white' : hasExisting ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {hasExisting ? `${existingCount} logged` : 'empty'}
                          </span>
                        </div>
                        <div className="font-mono text-xs font-semibold mt-1">
                          {label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Inputs */}
              <div className="space-y-2 pt-1 border-t border-slate-200">
                <label className="block text-[11px] font-bold text-slate-700 uppercase">
                  Session Hours for Selected Days:
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Clock In Time
                    </label>
                    <input
                      type="time"
                      step="1"
                      value={newInTime}
                      onChange={(e) => setNewInTime(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Clock Out Time
                    </label>
                    <input
                      type="time"
                      step="1"
                      value={newOutTime}
                      onChange={(e) => setNewOutTime(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Overnight switch */}
              <div className="flex items-center justify-between bg-white/80 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[11px] font-bold text-slate-700">
                  Clock Out Date:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBatchIsOvernight(false)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                      !batchIsOvernight ? 'bg-slate-800 text-white font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Same Day (Standard)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchIsOvernight(true)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                      batchIsOvernight ? 'bg-slate-800 text-white font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    +1 Day (Overnight Shift)
                  </button>
                </div>
              </div>

              {/* Project & Note */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                    Project
                  </label>
                  <select
                    value={newProjectId}
                    onChange={(e) => setNewProjectId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium"
                  >
                    <option value="">General / Unassigned</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                    Session Note / Objective
                  </label>
                  <input
                    type="text"
                    placeholder="Session objective or notes..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                  />
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleBatchAddSessions}
                  disabled={batchSelectedDates.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                  style={{ backgroundColor: themeColor }}
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    Add Session to {batchSelectedDates.length > 0 ? `All ${batchSelectedDates.length} Days` : 'Selected Days'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            {dirtyDates.length > 0 && (
              <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
                {dirtyDates.length} {dirtyDates.length === 1 ? 'Day' : 'Days'} Modified ({formatSecondsToHuman(totalModifiedSec)})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* Secondary: Save and keep editor open */}
            {dirtyDates.length > 0 && (
              <button
                type="button"
                onClick={() => handleSaveAll(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 transition-colors cursor-pointer"
                title="Save staged changes without closing modal so you can continue editing"
              >
                Save & Continue
              </button>
            )}

            {/* Primary: Save All & Close */}
            <button
              type="button"
              onClick={() => handleSaveAll(true)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all cursor-pointer hover:opacity-90 min-w-[170px]"
              style={{ backgroundColor: themeColor }}
              title={isClosedQuarter ? `Save sessions to closed quarter (${selectedDateQuarter}) - requires confirmation` : 'Save all sessions'}
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Saved Day Sessions!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>
                    {dirtyDates.length > 1
                      ? `Save All (${dirtyDates.length} Days)`
                      : dirtyDates.length === 1
                      ? `Save All for ${formatDateMMDDYYYY(dirtyDates[0])}`
                      : `Save All for ${formatDateMMDDYYYY(selectedDate)}`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Closed Quarter Modifications */}
      <ConfirmModal
        options={confirmDialog}
        onClose={() => setConfirmDialog(null)}
        themeColor={themeColor}
      />
    </div>
  );
}
