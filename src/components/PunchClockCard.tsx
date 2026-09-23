import { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Square, 
  Clock, 
  Calendar, 
  PlusCircle, 
  CheckCircle, 
  AlertCircle, 
  CalendarPlus,
  FolderKanban,
  FileText,
  Tag,
  Plus,
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  Check,
  X
} from 'lucide-react';
import { 
  formatDateToYYYYMMDD, 
  formatDateMMDDYYYY,
  formatTimeToHHMMSS, 
  formatTime24to12, 
  formatSecondsToHHMMSS, 
  getDurationInSeconds,
  getActiveElapsedSeconds
} from '../utils/timeCalculations';
import { DayRecord, PunchPair, Project } from '../types';
import { ConfirmModal, ConfirmDialogOptions } from './ConfirmModal';
import { EmptyState } from './EmptyState';
import { ProjectBadge } from './ProjectBadge';

interface PunchClockCardProps {
  todayRecord: DayRecord | undefined;
  projects?: Project[];
  selectedProjectId?: string;
  onSelectProject?: (projId: string) => void;
  onOpenProjectsModal?: () => void;
  onPunch: (type: 'IN' | 'OUT', customDate?: string, customTime?: string, projectId?: string, note?: string) => void;
  onUpdateTodaySessions?: (updatedPunches: PunchPair[]) => void;
  isPunchedIn: boolean;
  activeInTime: string | null;
  activeInDate?: string | null;
  isMultiDay?: boolean;
  lastPunchTime: string | null;
  statusMessage: { text: string; isError: boolean } | null;
  onDismissStatus: () => void;
  onOpenPastDateModal: () => void;
  themeColor?: string;
  secondaryColor?: string;
}

export function PunchClockCard({
  todayRecord,
  projects = [],
  selectedProjectId,
  onSelectProject,
  onOpenProjectsModal,
  onPunch,
  onUpdateTodaySessions,
  isPunchedIn,
  activeInTime,
  activeInDate,
  isMultiDay,
  lastPunchTime,
  statusMessage,
  onDismissStatus,
  onOpenPastDateModal,
  themeColor = '#0284C7',
  secondaryColor = '#0F172A',
}: PunchClockCardProps) {
  const [sessionSeconds, setSessionSeconds] = useState<number>(0);
  const [activeNote, setActiveNote] = useState<string>('');
  const [localSelectedProj, setLocalSelectedProj] = useState<string>(selectedProjectId || projects[0]?.id || '');
  const [isSessionsExpanded, setIsSessionsExpanded] = useState<boolean>(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogOptions | null>(null);

  // Editing session modal state
  const [editingSessionIdx, setEditingSessionIdx] = useState<number | null>(null);
  const [editInTime, setEditInTime] = useState<string>('');
  const [editOutTime, setEditOutTime] = useState<string>('');
  const [editProjectId, setEditProjectId] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');

  // Long press timer reference
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep local project in sync if external selection changes
  useEffect(() => {
    if (selectedProjectId) {
      setLocalSelectedProj(selectedProjectId);
    } else if (!localSelectedProj && projects[0]?.id) {
      setLocalSelectedProj(projects[0].id);
    }
  }, [selectedProjectId, projects]);

  // Active session stopwatch (supports multi-day and overnight sessions)
  useEffect(() => {
    if (!isPunchedIn || !activeInTime) {
      setSessionSeconds(0);
      return;
    }

    const calculateCurrentElapsed = () => {
      const dur = getActiveElapsedSeconds(activeInDate, activeInTime, new Date());
      setSessionSeconds(dur);
    };

    calculateCurrentElapsed();
    const interval = setInterval(calculateCurrentElapsed, 1000);
    return () => clearInterval(interval);
  }, [isPunchedIn, activeInTime, activeInDate]);

  const executePunch = (type: 'IN' | 'OUT') => {
    onPunch(type, undefined, undefined, localSelectedProj || undefined, activeNote.trim() || undefined);
    if (type === 'OUT') {
      setActiveNote('');
    }
  };

  const handlePunchClick = (type: 'IN' | 'OUT') => {
    if (type === 'IN' && isPunchedIn) {
      setConfirmDialog({
        title: 'Already Clocked In',
        message: 'You have an active session in progress. Would you like to clock in again to start a new session slot?',
        confirmText: 'Clock In Again',
        variant: 'warning',
        onConfirm: () => executePunch('IN'),
      });
      return;
    }
    if (type === 'OUT' && !isPunchedIn) {
      setConfirmDialog({
        title: 'Currently Clocked Out',
        message: 'You are not currently clocked in. Would you like to register a clock out entry anyway?',
        confirmText: 'Clock Out Anyway',
        variant: 'warning',
        onConfirm: () => executePunch('OUT'),
      });
      return;
    }
    executePunch(type);
  };

  const punches: PunchPair[] = todayRecord?.punches ? [...todayRecord.punches] : [];
  const activeSessionsCount = punches.filter((p) => Boolean(p.inTime || p.outTime)).length;
  const hasAnyActiveSessions = activeSessionsCount > 0;

  const currentActiveProj = projects.find((p) => p.id === localSelectedProj);

  // Retroactive project assignment for an existing session
  const handleRetroactiveProjectChange = (sessionIdx: number, newProjectId: string) => {
    const rawPunches = todayRecord?.punches ? [...todayRecord.punches] : [];
    if (!rawPunches[sessionIdx]) return;
    const targetProj = projects.find((p) => p.id === newProjectId);
    const updated = rawPunches.map((p, idx) => {
      if (idx === sessionIdx) {
        return {
          ...p,
          projectId: targetProj ? targetProj.id : undefined,
          projectName: targetProj ? targetProj.name : undefined,
        };
      }
      return p;
    });
    onUpdateTodaySessions?.(updated);
  };

  // Start editing a session
  const handleStartEditSession = (sessionIdx: number) => {
    const pair = punches[sessionIdx];
    if (!pair) return;
    setEditingSessionIdx(sessionIdx);
    setEditInTime(pair.inTime ? pair.inTime.substring(0, 5) : '');
    setEditOutTime(pair.outTime ? pair.outTime.substring(0, 5) : '');
    setEditProjectId(pair.projectId || '');
    setEditNote(pair.note || '');
  };

  // Save session edits
  const handleSaveSessionEdit = () => {
    if (editingSessionIdx === null) return;
    const rawPunches = todayRecord?.punches ? [...todayRecord.punches] : [];
    if (!rawPunches[editingSessionIdx]) return;
    const targetProj = projects.find((p) => p.id === editProjectId);
    
    const formattedIn = editInTime ? (editInTime.length === 5 ? `${editInTime}:00` : editInTime) : '';
    const formattedOut = editOutTime ? (editOutTime.length === 5 ? `${editOutTime}:00` : editOutTime) : '';

    const updated = rawPunches.map((p, idx) => {
      if (idx === editingSessionIdx) {
        return {
          inTime: formattedIn,
          outTime: formattedOut,
          projectId: targetProj ? targetProj.id : undefined,
          projectName: targetProj ? targetProj.name : undefined,
          note: editNote.trim() || undefined,
        };
      }
      return p;
    });

    onUpdateTodaySessions?.(updated);
    setEditingSessionIdx(null);
  };

  // Delete session
  const handleDeleteSession = (sessionIdx: number) => {
    setConfirmDialog({
      title: 'Delete Session Slot',
      message: 'Are you sure you want to delete this recorded session? This cannot be undone.',
      confirmText: 'Delete Session',
      variant: 'danger',
      onConfirm: () => {
        const rawPunches = todayRecord?.punches ? [...todayRecord.punches] : [];
        const updated = rawPunches.filter((_, idx) => idx !== sessionIdx);
        onUpdateTodaySessions?.(updated);
        setEditingSessionIdx(null);
      },
    });
  };

  // Long press handler functions
  const handleTouchStart = (idx: number) => {
    longPressTimerRef.current = setTimeout(() => {
      handleStartEditSession(idx);
    }, 600);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 md:p-6 transition-all hover:shadow-xs">
      {/* Top Banner Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div
            className={`w-3.5 h-3.5 rounded-full ${
              isPunchedIn
                ? 'bg-emerald-500 ring-4 ring-emerald-100 animate-pulse'
                : 'bg-slate-300 ring-4 ring-slate-100'
            }`}
          />
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Live Status
            </div>
            <div className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2 flex-wrap">
              {isPunchedIn ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-emerald-700">Clocked IN</span>
                  <span className="text-xs font-normal text-emerald-600 font-mono">
                    (Since {formatTime24to12(activeInTime)}{isMultiDay && activeInDate ? ` • ${formatDateMMDDYYYY(activeInDate)}` : ''})
                  </span>
                  {isMultiDay && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                      🌙 Multi-Day Active
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-slate-700">
                  Clocked OUT{' '}
                  {lastPunchTime && (
                    <span className="text-xs font-normal text-slate-500 font-mono">
                      (Last: {formatTime24to12(lastPunchTime)})
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Live Active Session Stopwatch - Standardized Option A */}
        {isPunchedIn && (
          <div className="flex items-center gap-3 bg-white border border-emerald-300 ring-1 ring-emerald-100 px-3.5 py-1.5 rounded-xl shadow-2xs">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shrink-0">
              <Clock className="w-4 h-4 animate-spin" style={{ animationDuration: '4s' }} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <span>Current Session</span>
                {sessionSeconds >= 86400 && (
                  <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1 rounded">
                    Day {Math.floor(sessionSeconds / 86400) + 1}
                  </span>
                )}
              </div>
              <div className="text-base font-black font-mono text-emerald-700 tracking-tight leading-none flex items-baseline gap-1">
                <span>{formatSecondsToHHMMSS(sessionSeconds)}</span>
                {sessionSeconds >= 86400 && (
                  <span className="text-[10px] font-bold text-indigo-600">
                    (+{Math.floor(sessionSeconds / 86400)}d)
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Project & Notes Annotation Row (Only shown once projects exist) */}
      {projects && projects.length > 0 && (
        <div className="my-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Project Selector */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5" style={{ color: themeColor }} />
                Active Project Assignment
              </label>
              <button
                type="button"
                onClick={onOpenProjectsModal}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
              >
                + Manage Projects
              </button>
            </div>
            <div className="relative flex items-center">
              {currentActiveProj && (
                <span
                  className="w-2.5 h-2.5 rounded-full absolute left-2.5 z-10"
                  style={{ backgroundColor: currentActiveProj.color || '#059669' }}
                />
              )}
              <select
                value={localSelectedProj}
                onChange={(e) => {
                  setLocalSelectedProj(e.target.value);
                  onSelectProject?.(e.target.value);
                }}
                className="w-full pl-7 pr-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-indigo-600 shadow-2xs"
              >
                <option value="">General / Unassigned Time</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.client ? `(${p.client})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Session Notes / Objective Accomplishments */}
          <div className="flex-1">
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" style={{ color: secondaryColor }} />
              Session Objectives / Accomplishment Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Completed Sprint milestone & client sync..."
              value={activeNote}
              onChange={(e) => setActiveNote(e.target.value)}
              className="w-full px-3 py-1.5 text-xs text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-emerald-600 shadow-2xs"
            />
          </div>
        </div>
      )}

      {/* Main Clock In / Clock Out Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-4">
        <button
          id="btn-clock-in"
          onClick={() => handlePunchClick('IN')}
          disabled={isPunchedIn}
          className={`group relative flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-bold transition-all ${
            isPunchedIn
              ? 'text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed opacity-80'
              : 'text-white bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:scale-[0.98] shadow-2xs shadow-emerald-700/20 border border-emerald-500 cursor-pointer'
          }`}
          title={isPunchedIn ? 'Currently clocked in — clock out to end your session' : 'Clock in to start a session'}
        >
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isPunchedIn
                ? 'bg-slate-200 text-slate-400'
                : 'bg-emerald-500/40 text-white group-hover:scale-110 transition-transform'
            }`}
          >
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
          <div className="text-left">
            <div className="text-sm font-extrabold tracking-wide uppercase">
              {isPunchedIn ? 'CLOCKED IN' : 'CLOCK IN'}
            </div>
            <div className={`text-[11px] font-normal ${isPunchedIn ? 'text-slate-500' : 'text-emerald-100'}`}>
              {isPunchedIn ? 'Active session in progress' : 'Start session'}
            </div>
          </div>
        </button>

        <button
          id="btn-clock-out"
          onClick={() => handlePunchClick('OUT')}
          disabled={!isPunchedIn}
          className={`group relative flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-bold transition-all ${
            isPunchedIn
              ? 'text-white bg-gradient-to-b from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:scale-[0.98] shadow-2xs shadow-rose-700/20 border border-rose-500 cursor-pointer'
              : 'text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed opacity-80'
          }`}
          title={isPunchedIn ? 'Clock out and save session duration' : 'Currently clocked out'}
        >
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isPunchedIn
                ? 'bg-rose-500/40 text-white group-hover:scale-110 transition-transform'
                : 'bg-slate-200 text-slate-400'
            }`}
          >
            <Square className="w-4 h-4 fill-current" />
          </div>
          <div className="text-left">
            <div className="text-sm font-extrabold tracking-wide uppercase">CLOCK OUT</div>
            <div className="text-[11px] font-normal opacity-90">
              End active session & save notes
            </div>
          </div>
        </button>
      </div>

      {/* COLLAPSIBLE SECTION: Today's Logged Sessions & Prior Date Entry */}
      <div className="mt-4 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={() => setIsSessionsExpanded(!isSessionsExpanded)}
          className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-left transition-colors cursor-pointer shadow-2xs"
          title="Toggle view of today's session logs and prior date management"
        >
          <div className="flex items-center gap-2">
            <ChevronDown
              className={`w-4 h-4 text-slate-600 transition-transform duration-200 ${
                isSessionsExpanded ? 'rotate-180' : ''
              }`}
            />
            <span className="text-xs font-bold text-slate-800">
              Today's Session Logs & Prior Dates
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
              {activeSessionsCount} session{activeSessionsCount !== 1 ? 's' : ''}
            </span>
          </div>

          <span className="text-[11px] font-medium text-slate-500 hidden sm:inline">
            {isSessionsExpanded ? 'Click to collapse' : 'Click to expand logs & edits'}
          </span>
        </button>

        {/* Collapsible Content Body */}
        {isSessionsExpanded && (
          <div className="mt-3 space-y-3.5 bg-slate-50/60 rounded-xl p-3 sm:p-4 border border-slate-200/70 animate-fadeIn">
            {/* Instruction Tip */}
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Tip: Tap or long-press any session to edit times, notes, or reassign projects retroactively.</span>
              <span className="font-mono text-slate-400">Unlimited slots</span>
            </div>

            {/* Sessions Grid */}
            {!hasAnyActiveSessions ? (
              <EmptyState
                icon={Clock}
                title="No Clock Sessions Recorded Today"
                description="Clock in using the button above to begin your active work session, or log a prior date session below."
                compact
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {punches.map((pair, slotIdx) => {
                  if (!pair?.inTime && !pair?.outTime) return null;
                  const hasIn = Boolean(pair?.inTime);
                  const hasOut = Boolean(pair?.outTime);
                  const isCurrentActive = hasIn && !hasOut;

                  let durText = '';
                  if (hasIn && hasOut) {
                    const s = getDurationInSeconds(pair.inTime, pair.outTime);
                    durText = formatSecondsToHHMMSS(s);
                  }

                  const matchProj = projects.find((p) => p.id === pair.projectId) || (pair.projectName ? { id: '', name: pair.projectName, color: '#6366f1' } : null);

                  return (
                    <div
                      key={slotIdx}
                      onTouchStart={() => handleTouchStart(slotIdx)}
                      onTouchEnd={handleTouchEnd}
                      onMouseDown={() => handleTouchStart(slotIdx)}
                      onMouseUp={handleTouchEnd}
                      className={`p-2.5 rounded-xl border transition-all text-left relative group ${
                        isCurrentActive
                          ? 'bg-emerald-50/90 border-emerald-300 ring-2 ring-emerald-200/80 shadow-xs'
                          : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
                      }`}
                    >
                      {/* Session Header */}
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                            #{slotIdx + 1}
                          </span>
                          {matchProj && (
                            <ProjectBadge
                              name={matchProj.name}
                              color={matchProj.color}
                              size="xs"
                            />
                          )}
                        </div>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleStartEditSession(slotIdx)}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Edit session details"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>

                      {/* In/Out Times */}
                      <div className="space-y-0.5 font-mono text-xs">
                        <div className="text-emerald-700 font-semibold truncate flex items-center justify-between">
                          <span>▶ {formatTime24to12(pair.inTime)}</span>
                          <span className="text-[10px] text-slate-400 font-normal">IN</span>
                        </div>
                        <div
                          className={`truncate flex items-center justify-between ${
                            hasOut ? 'text-rose-700 font-semibold' : 'text-emerald-600 font-bold animate-pulse'
                          }`}
                        >
                          <span>{hasOut ? `■ ${formatTime24to12(pair.outTime)}` : 'ACTIVE NOW'}</span>
                          <span className="text-[10px] text-slate-400 font-normal">OUT</span>
                        </div>
                        {durText && (
                          <div className="text-[10px] text-slate-500 font-semibold pt-1 border-t border-slate-100 flex items-center justify-between">
                            <span>Duration:</span>
                            <span className="font-bold text-slate-700">{durText}</span>
                          </div>
                        )}
                      </div>

                      {/* Retroactive Project Assignment Selector */}
                      {projects.length > 0 && (
                        <div className="mt-2 pt-1.5 border-t border-slate-100">
                          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">
                            Project
                          </label>
                          <select
                            value={pair.projectId || ''}
                            onChange={(e) => handleRetroactiveProjectChange(slotIdx, e.target.value)}
                            className="w-full text-[10px] font-semibold py-1 px-1.5 bg-slate-50 border border-slate-200 rounded-md outline-none text-slate-700 cursor-pointer"
                          >
                            <option value="">(No project / General)</option>
                            {projects.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Session Note */}
                      {pair.note && (
                        <div className="text-[10px] text-slate-600 italic truncate pt-1 mt-1 border-t border-slate-100" title={pair.note}>
                          "{pair.note}"
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Prior Dates Entry & Log Action Button */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-200/80">
              <button
                id="btn-open-past-date-entry"
                type="button"
                onClick={onOpenPastDateModal}
                className="inline-flex items-center gap-2 text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200/80 px-3.5 py-2 rounded-xl transition-colors cursor-pointer w-full sm:w-auto justify-center shadow-2xs"
              >
                <CalendarPlus className="w-4 h-4 text-teal-700" />
                <span>Log or Edit Sessions for Prior Dates</span>
              </button>

              <span className="text-[11px] text-slate-400 text-center sm:text-right">
                All changes automatically sync to your database & timesheets
              </span>
            </div>
          </div>
        )}
      </div>

      {/* EDIT SESSION MODAL */}
      {editingSessionIdx !== null && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-600" />
                Edit Session #{editingSessionIdx + 1}
              </h3>
              <button
                onClick={() => setEditingSessionIdx(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Start & End Times */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Clock In Time
                  </label>
                  <input
                    type="time"
                    step="1"
                    value={editInTime}
                    onChange={(e) => setEditInTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Clock Out Time
                  </label>
                  <input
                    type="time"
                    step="1"
                    value={editOutTime}
                    onChange={(e) => setEditOutTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Retroactive Project Selection */}
              {projects.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Project Assignment
                  </label>
                  <select
                    value={editProjectId}
                    onChange={(e) => setEditProjectId(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 text-xs"
                  >
                    <option value="">(No project / General Time)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.client ? `(${p.client})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Session Notes
                </label>
                <input
                  type="text"
                  placeholder="Notes about this session..."
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 text-xs"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleDeleteSession(editingSessionIdx)}
                className="px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSessionIdx(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSessionEdit}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Feedback Toast */}
      {statusMessage && (
        <div
          className={`mt-4 p-3 rounded-xl border flex items-center justify-between gap-2 text-xs font-medium ${
            statusMessage.isError
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.isError ? (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={onDismissStatus}
            className="text-xs text-slate-400 hover:text-slate-700 px-1 py-0.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
      {/* Confirmation Dialog Modal */}
      <ConfirmModal
        options={confirmDialog}
        onClose={() => setConfirmDialog(null)}
        themeColor={themeColor}
      />
    </div>
  );
}
