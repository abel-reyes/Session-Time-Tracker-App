import { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  CalendarDays, 
  Filter,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Target,
  Briefcase,
  FileText,
  Calendar
} from 'lucide-react';
import { QuarterWeekSummary, DayRecord, PunchPair, Project } from '../types';
import { 
  formatSecondsToHHMMSS, 
  formatSecondsToHuman, 
  formatTime24to12,
  getDurationInSeconds
} from '../utils/timeCalculations';
import { ProjectBadge } from './ProjectBadge';

interface QuarterWeeksModalProps {
  isOpen: boolean;
  onClose: () => void;
  quarterName: string;
  weeks: QuarterWeekSummary[];
  weeklyGoalHours?: number;
  themeColor?: string;
  secondaryColor?: string;
  records?: DayRecord[];
  projects?: Project[];
  liveExtraSeconds?: number;
}

type SortOption = 'newest' | 'oldest' | 'hours-desc';

const DAY_NAMES_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_LABELS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function QuarterWeeksModal({
  isOpen,
  onClose,
  quarterName,
  weeks,
  weeklyGoalHours = 0,
  themeColor = '#0284C7',
  secondaryColor = '#0F172A',
  records = [],
  projects = [],
  liveExtraSeconds = 0,
}: QuarterWeeksModalProps) {
  const [filterMode, setFilterMode] = useState<'with-data' | 'all'>('with-data');
  const [sortMode, setSortMode] = useState<SortOption>('newest');
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number | null>(null);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState<boolean>(false);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  // ESC key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (selectedWeekNumber !== null) {
          setSelectedWeekNumber(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, selectedWeekNumber]);

  // Reset selected week when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setSelectedWeekNumber(null);
    }
  }, [isOpen]);

  // Fast map of date -> DayRecord
  const recordMap = useMemo(() => {
    const map = new Map<string, DayRecord>();
    records.forEach((r) => {
      map.set(r.date, r);
    });
    return map;
  }, [records]);

  // Compute summary stats
  const { 
    totalQuarterSec, 
    activeWeeksCount, 
    avgWeeklyHours,
    weeklyAvgPerMonth,
  } = useMemo(() => {
    let totalSec = 0;
    let activeCount = 0;

    weeks.forEach((w) => {
      totalSec += w.totalSeconds;
      if (w.totalSeconds > 0) {
        activeCount++;
      }
    });

    const elapsedWeeks = Math.max(1, weeks.filter((w) => w.isPastWeek || w.isCurrentWeek).length);
    const avgHours = Number(((totalSec / 3600) / (activeCount > 0 ? activeCount : elapsedWeeks)).toFixed(1));

    // Group days by month to compute Weekly Average Per Month
    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthHoursMap = new Map<string, { seconds: number; daysWorked: number; activeWeeks: Set<number>; monthName: string }>();

    weeks.forEach((w) => {
      w.dailyDates.forEach((dateStr, idx) => {
        const ym = dateStr.slice(0, 7);
        const [yr, mo] = ym.split('-').map(Number);
        const dObj = new Date(yr, mo - 1, 1);
        const monthName = dObj.toLocaleDateString('en-US', { month: 'short' });

        if (!monthHoursMap.has(ym)) {
          monthHoursMap.set(ym, { seconds: 0, daysWorked: 0, activeWeeks: new Set(), monthName });
        }
        const mEntry = monthHoursMap.get(ym)!;
        const dayHours = w.dailyHours[idx] || 0;
        const daySec = Math.round(dayHours * 3600);
        mEntry.seconds += daySec;
        if (daySec > 0) {
          mEntry.daysWorked++;
          mEntry.activeWeeks.add(w.weekNumber);
        }
      });
    });

    let avgPerMonth = 0;

    const currentMonthEntry = monthHoursMap.get(currentYM);
    if (currentMonthEntry && currentMonthEntry.seconds > 0) {
      const daysElapsed = Math.max(1, now.getDate());
      const weeksElapsed = Math.max(1, daysElapsed / 7);
      const activeWks = Math.max(1, currentMonthEntry.activeWeeks.size);
      avgPerMonth = Number(((currentMonthEntry.seconds / 3600) / (activeWks > 0 ? activeWks : weeksElapsed)).toFixed(1));
    } else {
      let totalMonthAvgs = 0;
      let activeMonthCount = 0;
      monthHoursMap.forEach((mEntry) => {
        if (mEntry.seconds > 0) {
          const activeWks = Math.max(1, mEntry.activeWeeks.size);
          const avg = (mEntry.seconds / 3600) / activeWks;
          totalMonthAvgs += avg;
          activeMonthCount++;
        }
      });
      if (activeMonthCount > 0) {
        avgPerMonth = Number((totalMonthAvgs / activeMonthCount).toFixed(1));
      }
    }

    return {
      totalQuarterSec: totalSec,
      activeWeeksCount: activeCount,
      avgWeeklyHours: avgHours,
      weeklyAvgPerMonth: avgPerMonth,
    };
  }, [weeks]);

  // Selected week object
  const selectedWeek = useMemo(() => {
    if (selectedWeekNumber === null) return null;
    return weeks.find((w) => w.weekNumber === selectedWeekNumber) || null;
  }, [weeks, selectedWeekNumber]);

  // Helper to retrieve project color by id or name
  const getProjectColor = (projectId?: string, projectName?: string): string => {
    if (projectId) {
      const p = projects.find((x) => x.id === projectId);
      if (p && p.color) return p.color;
    }
    if (projectName) {
      const p = projects.find((x) => x.name.toLowerCase() === projectName.toLowerCase());
      if (p && p.color) return p.color;
    }
    return '#64748b';
  };

  // Map of weekNumber -> active projects worked during that week
  const weekProjectsMap = useMemo(() => {
    const map = new Map<number, { name: string; color: string }[]>();
    weeks.forEach((w) => {
      const projMap = new Map<string, string>();
      w.dailyDates.forEach((dStr) => {
        const rec = recordMap.get(dStr);
        if (rec?.punches) {
          rec.punches.forEach((p) => {
            if (p.projectName && p.projectName.trim()) {
              const pName = p.projectName.trim();
              if (!projMap.has(pName)) {
                projMap.set(pName, getProjectColor(p.projectId, pName));
              }
            } else if (p.projectId) {
              const matched = projects.find((pr) => pr.id === p.projectId);
              if (matched && !projMap.has(matched.name)) {
                projMap.set(matched.name, matched.color || '#64748b');
              }
            }
          });
        }
      });
      map.set(
        w.weekNumber,
        Array.from(projMap.entries()).map(([name, color]) => ({ name, color }))
      );
    });
    return map;
  }, [weeks, recordMap, projects]);

  // Selected week metrics & daily breakdown
  const selectedWeekDetails = useMemo(() => {
    if (!selectedWeek) return null;

    const daysData = selectedWeek.dailyDates.map((dateStr, idx) => {
      const rec = recordMap.get(dateStr);
      const dayHours = selectedWeek.dailyHours[idx] || 0;
      const daySeconds = Math.round(dayHours * 3600);
      
      const punches: PunchPair[] = (rec?.punches || []).filter(
        (p) => (p.inTime && p.inTime.trim() !== '') || (p.outTime && p.outTime.trim() !== '')
      );

      // Parse date to format nicely e.g., "Aug 24"
      const [year, month, day] = dateStr.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      return {
        dateStr,
        dayNameFull: DAY_NAMES_FULL[idx],
        dayLabelShort: DAY_LABELS_SHORT[idx],
        formattedDate,
        dayHours,
        daySeconds,
        hasHours: daySeconds > 0,
        punches,
        dayNote: rec?.notes || '',
      };
    });

    // Longest day in this week
    let longestDayIdx = 0;
    let maxDayHours = 0;
    daysData.forEach((d, idx) => {
      if (d.dayHours > maxDayHours) {
        maxDayHours = d.dayHours;
        longestDayIdx = idx;
      }
    });

    const activeDays = daysData.filter((d) => d.hasHours).length;
    const avgHoursPerActiveDay = activeDays > 0 ? Number((selectedWeek.totalHours / activeDays).toFixed(1)) : 0;

    // Project breakdown for this week
    const projectTimeMap = new Map<string, { name: string; seconds: number; color?: string }>();
    let totalPunchedSeconds = 0;
    let totalSessionCount = 0;

    daysData.forEach((d) => {
      d.punches.forEach((p) => {
        if (p.inTime && p.outTime) {
          totalSessionCount++;
          const pSec = getDurationInSeconds(p.inTime, p.outTime);
          totalPunchedSeconds += pSec;
          const pName = p.projectName && p.projectName.trim() !== '' ? p.projectName.trim() : 'General / Standard';
          const pColor = getProjectColor(p.projectId, p.projectName);
          const existing = projectTimeMap.get(pName) || { name: pName, seconds: 0, color: pColor };
          existing.seconds += pSec;
          projectTimeMap.set(pName, existing);
        }
      });
    });

    const projectBreakdown = Array.from(projectTimeMap.values())
      .map((proj) => ({
        name: proj.name,
        seconds: proj.seconds,
        color: proj.color || '#64748b',
        hours: Number((proj.seconds / 3600).toFixed(1)),
        percent: selectedWeek.totalSeconds > 0 ? Math.round((proj.seconds / selectedWeek.totalSeconds) * 100) : 0,
      }))
      .sort((a, b) => b.seconds - a.seconds);

    // Collect all notes
    const allNotes: { day: string; date: string; note: string; project?: string; projectId?: string }[] = [];
    daysData.forEach((d) => {
      if (d.dayNote && d.dayNote.trim() !== '') {
        allNotes.push({ day: d.dayNameFull, date: d.formattedDate, note: d.dayNote.trim() });
      }
      d.punches.forEach((p) => {
        if (p.note && p.note.trim() !== '') {
          allNotes.push({
            day: d.dayNameFull,
            date: d.formattedDate,
            note: p.note.trim(),
            project: p.projectName,
            projectId: p.projectId,
          });
        }
      });
    });

    // Comparison vs Quarter weekly average
    const vsAvgPct = avgWeeklyHours > 0 
      ? Math.round(((selectedWeek.totalHours - avgWeeklyHours) / avgWeeklyHours) * 100)
      : 0;

    return {
      daysData,
      longestDayName: maxDayHours > 0 ? DAY_NAMES_FULL[longestDayIdx] : '--',
      longestDayHours: maxDayHours,
      activeDays,
      avgHoursPerActiveDay,
      totalSessionCount,
      projectBreakdown,
      allNotes,
      vsAvgPct,
    };
  }, [selectedWeek, recordMap, avgWeeklyHours, projects]);

  // When a week is opened, default all days of the week to collapsed
  useEffect(() => {
    setExpandedDays({});
  }, [selectedWeekNumber]);

  const toggleDay = (dateStr: string) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dateStr]: !prev[dateStr],
    }));
  };

  const allExpanded = useMemo(() => {
    if (!selectedWeekDetails || selectedWeekDetails.daysData.length === 0) return false;
    return selectedWeekDetails.daysData.every((d) => !!expandedDays[d.dateStr]);
  }, [selectedWeekDetails, expandedDays]);

  const toggleAllDays = () => {
    if (!selectedWeekDetails) return;
    const nextState = !allExpanded;
    const updated: Record<string, boolean> = {};
    selectedWeekDetails.daysData.forEach((d) => {
      updated[d.dateStr] = nextState;
    });
    setExpandedDays(updated);
  };

  // Filter and sort weeks for the list view
  const displayWeeks = useMemo(() => {
    let result = [...weeks];
    if (filterMode === 'with-data') {
      result = result.filter((w) => w.totalSeconds > 0);
    }
    if (sortMode === 'newest') {
      result.sort((a, b) => b.weekNumber - a.weekNumber);
    } else if (sortMode === 'oldest') {
      result.sort((a, b) => a.weekNumber - b.weekNumber);
    } else if (sortMode === 'hours-desc') {
      result.sort((a, b) => b.totalSeconds - a.totalSeconds);
    }
    return result;
  }, [weeks, filterMode, sortMode]);

  if (!isOpen) return null;

  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quarter-weeks-title"
    >
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92dvh] sm:max-h-[90vh]">
        {/* ======================================================== */}
        {/* VIEW 1: SELECTED WEEK DETAIL & STATS VIEW                */}
        {/* ======================================================== */}
        {selectedWeek && selectedWeekDetails ? (
          <>
            {/* Week Detail Header */}
            <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/90 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setSelectedWeekNumber(null)}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/80 hover:bg-slate-100 active:scale-95 text-slate-700 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>All Weeks</span>
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                      {selectedWeek.weekLabel}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      ({selectedWeek.dateRangeFormatted})
                    </span>
                  </div>
                </div>
              </div>

              {/* Prev / Next Week Stepper & Close */}
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="flex items-center bg-white rounded-lg border border-slate-200 p-0.5 shadow-2xs">
                  <button
                    type="button"
                    disabled={selectedWeek.weekNumber <= 1}
                    onClick={() => setSelectedWeekNumber(selectedWeek.weekNumber - 1)}
                    className="p-1 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
                    title="Previous Week"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[10px] font-mono font-bold px-1.5 text-slate-500">
                    Wk {selectedWeek.weekOfYear || selectedWeek.weekNumber}
                  </span>
                  <button
                    type="button"
                    disabled={selectedWeek.weekNumber >= weeks.length}
                    onClick={() => setSelectedWeekNumber(selectedWeek.weekNumber + 1)}
                    className="p-1 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
                    title="Next Week"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Selected Week KPIs (4 Cards) */}
            <div className="px-4 sm:px-5 py-3 bg-slate-50/40 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
              {/* 1. Total */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Total
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-lg sm:text-xl font-extrabold text-slate-900 font-mono">
                    {selectedWeek.totalHours.toFixed(1)}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">hrs</span>
                </div>
                <div className="flex items-center justify-between text-[10px] mt-0.5">
                  <span className="font-mono text-slate-400">
                    {formatSecondsToHHMMSS(selectedWeek.totalSeconds)}
                  </span>
                </div>
              </div>

              {/* 2. Active Days */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Active Days
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-lg sm:text-xl font-extrabold text-slate-800 font-mono">
                    {selectedWeekDetails.activeDays}
                  </span>
                  <span className="text-xs font-normal text-slate-400">/ 7 days</span>
                </div>
              </div>

              {/* 3. Longest Day */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Longest Day
                </span>
                <div 
                  className="text-sm sm:text-base font-extrabold font-mono mt-0.5 truncate"
                  style={{ color: themeColor }}
                >
                  {selectedWeekDetails.longestDayName}
                </div>
                <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                  {selectedWeekDetails.longestDayHours > 0 ? `${selectedWeekDetails.longestDayHours.toFixed(1)} hrs logged` : '--'}
                </span>
              </div>

              {/* 4. Target or Session Count */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  {weeklyGoalHours > 0 ? 'Weekly Goal' : 'Total Sessions'}
                </span>
                {weeklyGoalHours > 0 ? (
                  <>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-lg sm:text-xl font-extrabold font-mono text-slate-900">
                        {Math.round(((selectedWeek.totalSeconds / 3600) / weeklyGoalHours) * 100)}%
                      </span>
                      <span className="text-[10px] text-slate-400 font-sans">of {weeklyGoalHours}h</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1">
                      <div 
                        className="h-full rounded-full"
                        style={{ 
                          width: `${Math.min(100, Math.round(((selectedWeek.totalSeconds / 3600) / weeklyGoalHours) * 100))}%`,
                          backgroundColor: themeColor,
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-lg sm:text-xl font-extrabold font-mono text-slate-900 mt-0.5">
                    {selectedWeekDetails.totalSessionCount}
                  </div>
                )}
              </div>
            </div>

            {/* Scrollable Content: Projects breakdown & Day-by-Day Session Cards */}
            <div className="p-3.5 sm:p-5 overflow-y-auto flex-1 space-y-4 bg-slate-50/50">
              {/* Project Time Distribution (if projects exist) */}
              {selectedWeekDetails.projectBreakdown.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5" style={{ color: themeColor }} />
                      Project Distribution ({selectedWeek.weekLabel})
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {selectedWeekDetails.projectBreakdown.length} active project{selectedWeekDetails.projectBreakdown.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {selectedWeekDetails.projectBreakdown.map((proj, pIdx) => (
                      <div 
                        key={pIdx}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                      >
                        <div className="overflow-hidden min-w-0 mr-2 flex items-center gap-2">
                          <div 
                            className="w-2.5 h-2.5 rounded-full shrink-0" 
                            style={{ backgroundColor: proj.color || '#64748b' }}
                          />
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-800 block truncate" title={proj.name}>
                              {proj.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {formatSecondsToHHMMSS(proj.seconds)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold font-mono text-slate-900 block">
                            {proj.hours}h
                          </span>
                          <span className="text-[10px] font-semibold" style={{ color: themeColor }}>
                            {proj.percent}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Day-by-Day Session Breakdown (Monday to Sunday) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" style={{ color: themeColor }} />
                    Daily Sessions
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleAllDays}
                      className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-0.5 rounded-md transition-colors cursor-pointer"
                    >
                      {allExpanded ? 'Collapse All' : 'Expand All'}
                    </button>
                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                      Monday – Sunday
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {selectedWeekDetails.daysData.map((d, dayIdx) => {
                    const isExpanded = !!expandedDays[d.dateStr];
                    const hasPunches = d.punches.length > 0;
                    const isToday = d.dateStr === new Date().toISOString().slice(0, 10);
                    const punchCount = d.punches.length;

                    return (
                      <div 
                        key={dayIdx}
                        className={`rounded-xl border transition-all overflow-hidden ${
                          d.hasHours
                            ? isToday 
                              ? 'bg-white border-blue-300 ring-1.5 ring-blue-100 shadow-xs'
                              : 'bg-white border-slate-200/80 shadow-2xs'
                            : 'bg-slate-100/40 border-slate-200/40'
                        }`}
                      >
                        {/* Day Header Row (Clickable Accordion Header) */}
                        <button
                          type="button"
                          onClick={() => toggleDay(d.dateStr)}
                          aria-expanded={isExpanded}
                          className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left cursor-pointer transition-colors hover:bg-slate-50/80 ${
                            isExpanded ? 'border-b border-slate-100' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <ChevronDown 
                              className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                                isExpanded ? 'rotate-0 text-slate-700' : '-rotate-90'
                              }`} 
                            />
                            <div className="min-w-0 flex items-center flex-wrap gap-x-1.5 gap-y-0.5">
                              <span className="text-xs font-bold text-slate-900">
                                {d.dayNameFull}
                              </span>
                              <span className="text-xs text-slate-500">
                                {d.formattedDate}
                              </span>
                              {isToday && (
                                <span className="text-[10px] font-semibold" style={{ color: themeColor }}>
                                  (Today)
                                </span>
                              )}
                              {punchCount > 0 && (
                                <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                  {punchCount} {punchCount === 1 ? 'log' : 'logs'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Day Total */}
                          <div className="flex items-center gap-2.5 shrink-0">
                            <div className="text-right">
                              <span className="text-xs sm:text-sm font-extrabold font-mono text-slate-900 block leading-tight">
                                {d.dayHours.toFixed(1)} <span className="text-[10px] font-sans font-semibold text-slate-400">hrs</span>
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {formatSecondsToHHMMSS(d.daySeconds)}
                              </span>
                            </div>
                          </div>
                        </button>

                        {/* Day Punches / Sessions List (Collapsible) */}
                        {isExpanded && (
                          <div className="animate-fadeIn">
                            {hasPunches ? (
                              <div className="p-2.5 space-y-1.5 bg-slate-50/30">
                                {d.punches.map((p, pIdx) => {
                                  const sessionDurationSec = getDurationInSeconds(p.inTime, p.outTime);
                                  const projectColor = getProjectColor(p.projectId, p.projectName);
                                  return (
                                    <div 
                                      key={pIdx}
                                      className="p-2.5 rounded-lg bg-white border border-slate-200/60 text-xs shadow-2xs space-y-1.5"
                                    >
                                      {/* Line 1: [start - stop times] */}
                                      <div className="font-mono font-bold text-slate-800 text-xs tracking-tight">
                                        {formatTime24to12(p.inTime)} – {p.outTime ? formatTime24to12(p.outTime) : 'Active'}
                                      </div>

                                      {/* Line 2: [duration] [project flag] */}
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                          {formatSecondsToHuman(sessionDurationSec)}
                                        </span>
                                        {p.projectName && (
                                          <ProjectBadge
                                            name={p.projectName}
                                            color={projectColor}
                                            size="sm"
                                          />
                                        )}
                                      </div>

                                      {/* Line 3: [note] (only if there are notes for the log) */}
                                      {p.note && p.note.trim().length > 0 && (
                                        <div className="pt-1 mt-0.5 border-t border-slate-100 text-[11px] text-slate-600 italic leading-relaxed break-words">
                                          "{p.note.trim()}"
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}

                                {d.dayNote && (
                                  <div className="text-[11px] text-slate-600 bg-amber-50/60 border border-amber-200/60 rounded-lg p-2 flex items-start gap-1.5">
                                    <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                    <span><strong>Day Note:</strong> {d.dayNote}</span>
                                  </div>
                                )}
                              </div>
                            ) : d.hasHours ? (
                              <div className="px-3.5 py-2.5 text-[11px] text-slate-500 bg-slate-50/30 flex items-center justify-between">
                                <span>Logged session hours recorded</span>
                                <span className="font-mono font-semibold">{formatSecondsToHuman(d.daySeconds)}</span>
                              </div>
                            ) : (
                              <div className="px-3.5 py-2.5 text-[11px] text-slate-400 italic bg-slate-50/20">
                                No sessions logged on this day (0.0 hrs)
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Weekly Notes Summary (if any) */}
              {selectedWeekDetails.allNotes.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2.5">
                    <FileText className="w-3.5 h-3.5" style={{ color: secondaryColor }} />
                    Week’s Notes
                  </span>
                  <div className="space-y-2">
                    {selectedWeekDetails.allNotes.map((n, idx) => {
                      const projColor = getProjectColor(n.projectId, n.project);
                      return (
                        <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100/90 text-xs space-y-1.5 hover:bg-slate-100/60 transition-colors">
                          {/* Line 1: [day of week]([mmm dd]): [project pill] */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-800 shrink-0">
                              {n.day}({n.date}):
                            </span>
                            <ProjectBadge
                              name={n.project || 'General'}
                              color={projColor}
                              size="xs"
                            />
                          </div>
                          {/* Line 2: [note] */}
                          <p className="text-slate-700 text-xs leading-relaxed break-words font-normal pl-0.5">
                            {n.note}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Week Detail Footer */}
            <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedWeekNumber(null)}
                className="font-bold hover:underline transition-colors cursor-pointer flex items-center gap-1"
                style={{ color: themeColor }}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to All Weeks
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl font-bold text-white shadow-2xs transition-all cursor-pointer hover:opacity-90 active:scale-98 text-xs"
                style={{ backgroundColor: themeColor }}
              >
                Close
              </button>
            </div>
          </>
        ) : (
          /* ======================================================== */
          /* VIEW 2: QUARTER OVERVIEW (ALL WEEKS LIST)                */
          /* ======================================================== */
          <>
            {/* Header */}
            <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-3">
                <div 
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-2xs shrink-0"
                  style={{ backgroundColor: themeColor }}
                >
                  <CalendarDays className="w-4.5 h-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 id="quarter-weeks-title" className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                      Quarter Weeks Tracker
                    </h2>
                    <span className="text-xs font-semibold text-slate-500">
                      • {quarterName}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Click any week to inspect detailed stats, session breakdown & projects.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Top KPI: Left = Average Per Month, Right = Average Per Quarter */}
            <div className="px-4 sm:px-5 py-3 bg-slate-50/40 border-b border-slate-100 grid grid-cols-2 gap-3 shrink-0">
              {/* 1. Average Per Month */}
              <div className="bg-white p-3 rounded-xl border border-slate-200/70 shadow-2xs flex flex-col justify-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Average Per Month
                </span>
                <span className="text-base sm:text-lg font-extrabold font-mono leading-tight mt-0.5" style={{ color: themeColor }}>
                  {weeklyAvgPerMonth} <span className="text-xs font-normal text-slate-500">hrs/wk</span>
                </span>
              </div>

              {/* 2. Average Per Quarter */}
              <div className="bg-white p-3 rounded-xl border border-slate-200/70 shadow-2xs flex flex-col justify-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Average Per Quarter
                </span>
                <span className="text-base sm:text-lg font-extrabold font-mono leading-tight mt-0.5 text-slate-800">
                  {avgWeeklyHours} <span className="text-xs font-normal text-slate-500">hrs/wk</span>
                </span>
              </div>
            </div>

            {/* Collapsible Filter & Sort Bar */}
            <div className="px-4 sm:px-5 py-2 border-b border-slate-100 bg-white shrink-0">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <span>Filter & Sort Options</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
                      isFilterDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <div className="text-[11px] font-medium text-slate-500 font-mono">
                  Showing {displayWeeks.length} of {weeks.length} weeks
                </div>
              </div>

              {/* Expandable Menu Body */}
              {isFilterDropdownOpen && (
                <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs animate-fadeIn">
                  {/* View Filter */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-bold text-[11px]">View:</span>
                    <button
                      type="button"
                      onClick={() => setFilterMode('with-data')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        filterMode === 'with-data'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Weeks with Data ({weeks.filter(w => w.totalSeconds > 0).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterMode('all')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        filterMode === 'all'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      All Weeks ({weeks.length})
                    </button>
                  </div>

                  {/* Sort Mode */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-bold text-[11px]">Sort:</span>
                    <button
                      type="button"
                      onClick={() => setSortMode('newest')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        sortMode === 'newest'
                          ? 'text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      style={sortMode === 'newest' ? { backgroundColor: secondaryColor } : undefined}
                    >
                      Newest First
                    </button>
                    <button
                      type="button"
                      onClick={() => setSortMode('oldest')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        sortMode === 'oldest'
                          ? 'text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      style={sortMode === 'oldest' ? { backgroundColor: secondaryColor } : undefined}
                    >
                      Oldest First
                    </button>
                    <button
                      type="button"
                      onClick={() => setSortMode('hours-desc')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        sortMode === 'hours-desc'
                          ? 'text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      style={sortMode === 'hours-desc' ? { backgroundColor: secondaryColor } : undefined}
                    >
                      Highest Hours
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Weeks Scrollable List (Clickable Ultra-Slim Rows, No Badges) */}
            <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-1.5 bg-slate-50/50">
              {displayWeeks.map((w) => {
                const hasHours = w.totalSeconds > 0;
                const goalPct = weeklyGoalHours > 0 ? Math.round(((w.totalSeconds / 3600) / weeklyGoalHours) * 100) : null;
                const weekNumDisplay = w.weekOfYear || w.weekNumber;
                const activeProjs = weekProjectsMap.get(w.weekNumber) || [];

                return (
                  <button
                    key={w.weekNumber}
                    type="button"
                    onClick={() => setSelectedWeekNumber(w.weekNumber)}
                    className={`w-full text-left px-3 py-2 rounded-xl border transition-all flex items-center justify-between gap-2.5 cursor-pointer group ${
                      w.isCurrentWeek
                        ? 'bg-white border-blue-300 ring-1.5 ring-blue-200 shadow-2xs hover:border-blue-400 hover:shadow-xs'
                        : hasHours
                        ? 'bg-white border-slate-200/80 shadow-2xs hover:border-slate-300 hover:shadow-xs'
                        : 'bg-slate-100/50 border-slate-200/40 opacity-70 hover:opacity-100 hover:bg-white'
                    }`}
                    title="Click to view weekly stats and daily sessions"
                  >
                    {/* Left: Compact Wk Indicator & Date Range */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div 
                        className="w-8 h-8 rounded-lg flex flex-col items-center justify-center shrink-0 shadow-2xs font-bold transition-transform group-hover:scale-105"
                        style={
                          w.isCurrentWeek 
                            ? { backgroundColor: themeColor, color: '#ffffff' } 
                            : hasHours 
                            ? { backgroundColor: `${themeColor}1a`, color: themeColor, borderColor: `${themeColor}40`, borderWidth: '1px' } 
                            : { backgroundColor: '#f1f5f9', color: '#94a3b8' }
                        }
                      >
                        <span className="text-[8px] uppercase font-semibold leading-none">Wk</span>
                        <span className="text-xs font-extrabold leading-none mt-0.5">{weekNumDisplay}</span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {w.dateRangeFormatted}
                          </span>
                          {w.isCurrentWeek && (
                            <span className="text-[10px] font-semibold" style={{ color: themeColor }}>
                              (Current)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                          <span>{w.daysWorked > 0 ? `${w.daysWorked}d active` : 'No sessions'}</span>
                          {activeProjs.length > 0 && (
                            <div className="hidden sm:flex items-center gap-1 ml-1">
                              {activeProjs.slice(0, 2).map((p, pIdx) => (
                                <ProjectBadge key={pIdx} name={p.name} color={p.color} size="xs" />
                              ))}
                              {activeProjs.length > 2 && (
                                <span className="text-[9px] font-semibold text-slate-400">+{activeProjs.length - 2}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Slim Daily Distribution, Hours Total, & Arrow */}
                    <div className="flex items-center gap-3 shrink-0">
                      {/* Daily mini distribution bars */}
                      <div className="hidden sm:flex items-end gap-0.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100/80">
                        {w.dailyHours.map((dHours, dayIdx) => {
                          const dayHeight = Math.min(14, Math.max(2.5, (dHours / 10) * 14));
                          return (
                            <div 
                              key={dayIdx} 
                              className="flex flex-col items-center gap-0.5"
                              title={`${dayLabels[dayIdx]}: ${dHours}h`}
                            >
                              <div 
                                className="w-1.5 rounded-xs transition-all"
                                style={{
                                  height: `${dayHeight}px`,
                                  backgroundColor: dHours > 0 ? themeColor : '#e2e8f0'
                                }}
                              />
                              <span className="text-[8px] font-bold text-slate-400 leading-none">
                                {dayLabels[dayIdx]}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Total hours */}
                      <div className="text-right min-w-[75px] sm:min-w-[85px]">
                        <div className="text-sm sm:text-base font-extrabold font-mono text-slate-900 leading-tight">
                          {w.totalHours.toFixed(1)} <span className="text-[10px] font-sans font-semibold text-slate-400">hrs</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {formatSecondsToHHMMSS(w.totalSeconds)}
                        </div>
                      </div>

                      {/* Chevron Arrow */}
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: secondaryColor }}></span>
                <span>Select any week to open metrics & session breakdown</span>
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl font-bold text-white shadow-2xs transition-all cursor-pointer hover:opacity-90 active:scale-98 text-xs"
                style={{ backgroundColor: themeColor }}
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

