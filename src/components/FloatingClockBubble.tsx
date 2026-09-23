import { useState, useEffect, useRef } from 'react';
import { 
  Clock, 
  Play, 
  Square, 
  ChevronDown, 
  ChevronRight, 
  X, 
  FolderKanban, 
  Tag, 
  AlertCircle, 
  CheckCircle, 
  FileText,
  ExternalLink
} from 'lucide-react';
import { 
  formatTimeToHHMMSS, 
  formatTime24to12, 
  formatDateMMDDYYYY,
  formatSecondsToHHMMSS, 
  getDurationInSeconds,
  getActiveElapsedSeconds
} from '../utils/timeCalculations';
import { DayRecord, PunchPair, Project } from '../types';
import { ConfirmModal, ConfirmDialogOptions } from './ConfirmModal';
import { ProjectBadge } from './ProjectBadge';

interface FloatingClockBubbleProps {
  todayRecord: DayRecord | undefined;
  projects?: Project[];
  selectedProjectId?: string;
  onSelectProject?: (projId: string) => void;
  onPunch: (type: 'IN' | 'OUT', customDate?: string, customTime?: string, projectId?: string, note?: string) => void;
  isPunchedIn: boolean;
  activeInTime: string | null;
  activeInDate?: string | null;
  isMultiDay?: boolean;
  lastPunchTime: string | null;
  themeColor: string;
  secondaryColor?: string;
  onNavigateToClockTab?: () => void;
}

export function FloatingClockBubble({
  todayRecord,
  projects = [],
  selectedProjectId,
  onSelectProject,
  onPunch,
  isPunchedIn,
  activeInTime,
  activeInDate,
  isMultiDay,
  lastPunchTime,
  themeColor,
  secondaryColor = '#0F172A',
  onNavigateToClockTab,
}: FloatingClockBubbleProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [sessionSeconds, setSessionSeconds] = useState<number>(0);
  const [activeNote, setActiveNote] = useState<string>('');
  const [localSelectedProj, setLocalSelectedProj] = useState<string>(selectedProjectId || projects[0]?.id || '');
  const [statusBanner, setStatusBanner] = useState<{ text: string; isError: boolean } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogOptions | null>(null);

  // Sync project selection
  useEffect(() => {
    if (selectedProjectId) {
      setLocalSelectedProj(selectedProjectId);
    } else if (!localSelectedProj && projects[0]?.id) {
      setLocalSelectedProj(projects[0].id);
    }
  }, [selectedProjectId, projects]);

  // Live stopwatch when clocked in (supports multi-day and overnight sessions)
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
    
    setStatusBanner({
      text: type === 'IN' ? 'Clocked In successfully!' : 'Clocked Out & session saved!',
      isError: false,
    });
    setTimeout(() => setStatusBanner(null), 3000);

    if (type === 'OUT') {
      setActiveNote('');
      // Auto-close sheet after punching out
      setTimeout(() => setIsOpen(false), 700);
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
  const currentActiveProj = projects.find((p) => p.id === localSelectedProj);

  return (
    <>
      {/* 1. FLOATING BUBBLE (Elevated above the bottom footer & links) */}
      <div className="fixed bottom-24 sm:bottom-20 left-4 sm:left-5 z-40 print:hidden select-none">
        <button
          type="button"
          id="persistent-floating-clock-bubble"
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2 p-3.5 rounded-2xl shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer text-white border-2 border-white/20"
          style={{ backgroundColor: themeColor }}
          title={isPunchedIn ? `Active Session: ${formatSecondsToHHMMSS(sessionSeconds)} (Click to open clock)` : 'Click to open quick clock drawer'}
          aria-label="Open Quick Clock"
        >
          {/* Animated pulse ring if session is active */}
          {isPunchedIn && (
            <span
              className="absolute -top-1 -right-1 flex h-3.5 w-3.5"
            >
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white"></span>
            </span>
          )}

          <div className="flex items-center justify-center">
            <Clock className={`w-5 h-5 ${isPunchedIn ? 'animate-pulse' : ''}`} />
          </div>

          {/* Mini Live Timer Badge if Clocked In */}
          {isPunchedIn ? (
            <div className="flex flex-col text-left pr-0.5">
              <span className="text-[9px] font-extrabold tracking-wider uppercase opacity-90 leading-tight flex items-center gap-1">
                Active
                {isMultiDay && <span className="text-[8px] bg-white/30 px-1 rounded-sm">🌙 +{Math.max(1, Math.floor(sessionSeconds / 86400))}d</span>}
              </span>
              <span className="font-mono text-xs font-black tracking-tight leading-tight">
                {formatSecondsToHHMMSS(sessionSeconds)}
              </span>
            </div>
          ) : (
            <span className="hidden sm:inline-block text-xs font-bold tracking-wide pr-1">
              Clock
            </span>
          )}
        </button>
      </div>

      {/* 2. SLIDE-UP BOTTOM SHEET / QUICK ACTION DRAWER */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fadeIn">
          {/* Backdrop dismiss click */}
          <div 
            className="flex-1 w-full" 
            onClick={() => setIsOpen(false)} 
            aria-label="Close clock drawer"
          />

          {/* Drawer Container */}
          <div 
            className="w-full max-w-lg mx-auto bg-white rounded-t-3xl shadow-2xl border-t border-slate-200/80 overflow-hidden flex flex-col max-h-[88vh] animate-slideUp"
          >
            {/* Header / Grab Bar */}
            <div className="px-4 sm:px-5 pt-3 pb-2.5 flex flex-col items-center justify-center relative border-b border-slate-100">
              <div className="w-12 h-1.5 bg-slate-300 rounded-full mb-2 cursor-pointer active:bg-slate-400 transition-colors" onClick={() => setIsOpen(false)} />
              
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="p-1.5 rounded-lg text-white"
                    style={{ backgroundColor: themeColor }}
                  >
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-tight">Quick Clock</h3>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${isPunchedIn ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                      {isPunchedIn ? 'Session currently in progress' : 'Ready to start session'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {onNavigateToClockTab && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onNavigateToClockTab();
                      }}
                      className="p-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg flex items-center gap-1 font-medium transition-colors"
                      title="Switch to full Clock In/Out tab"
                    >
                      <span className="text-[11px] hidden sm:inline">Full Tab</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Status Banner */}
            {statusBanner && (
              <div className={`mx-4 mt-2.5 px-3 py-2 rounded-xl text-xs flex items-center gap-2 font-medium ${
                statusBanner.isError ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}>
                {statusBanner.isError ? <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" /> : <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />}
                <span>{statusBanner.text}</span>
              </div>
            )}

            {/* Scrollable Action Content - Refined Mobile Density & Thumb Ergonomics */}
            <div className="px-4 pt-2.5 pb-6 sm:p-5 overflow-y-auto space-y-3 sm:space-y-4">
              {/* Live Timer Display when clocked in - Option A Standardized Surface */}
              {isPunchedIn && (
                <div className="p-3 sm:p-4 bg-white border border-emerald-300 ring-1 ring-emerald-100 rounded-2xl flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shrink-0">
                      <Clock className="w-5 h-5 animate-spin" style={{ animationDuration: '4s' }} />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                        <span>Elapsed Time</span>
                        {isMultiDay && (
                          <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                            🌙 Multi-Day Active
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-2xl font-black text-emerald-700 tracking-tight leading-none flex items-baseline gap-1">
                        <span>{formatSecondsToHHMMSS(sessionSeconds)}</span>
                        {sessionSeconds >= 86400 && (
                          <span className="text-xs font-bold text-indigo-600">
                            (+{Math.floor(sessionSeconds / 86400)}d)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-500 space-y-0.5 shrink-0 pl-2">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Clocked In</div>
                    <div className="font-mono font-bold text-slate-800">
                      {activeInTime ? formatTime24to12(activeInTime) : '--:--'}
                    </div>
                    {isMultiDay && activeInDate && (
                      <div className="text-[9px] font-semibold text-slate-400">
                        {formatDateMMDDYYYY(activeInDate)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Project Picker (if projects exist) */}
              {projects.length > 0 && (
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FolderKanban className="w-3.5 h-3.5" style={{ color: themeColor }} />
                      Assign Project
                    </span>
                  </label>

                  <div className="relative flex items-center">
                    {currentActiveProj && (
                      <span
                        className="w-2.5 h-2.5 rounded-full absolute left-3 z-10 pointer-events-none"
                        style={{ backgroundColor: currentActiveProj.color || '#059669' }}
                      />
                    )}
                    <select
                      value={localSelectedProj}
                      onChange={(e) => {
                        setLocalSelectedProj(e.target.value);
                        onSelectProject?.(e.target.value);
                      }}
                      className={`w-full bg-slate-50 border border-slate-200 rounded-xl ${
                        currentActiveProj ? 'pl-8' : 'pl-3'
                      } pr-3 py-2 text-xs font-semibold text-slate-800 focus:outline-slate-900 focus:bg-white transition-colors cursor-pointer`}
                    >
                      <option value="">(No Project / General Session)</option>
                      {projects
                        .filter((p) => !p.archived && !p.isDeleted)
                        .map((proj) => (
                          <option key={proj.id} value={proj.id}>
                            {proj.name} {proj.client ? `(${proj.client})` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Session Objectives / Accomplishment Notes */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" style={{ color: secondaryColor }} />
                  Session Objectives / Accomplishment Notes
                </label>
                <input
                  type="text"
                  placeholder={isPunchedIn ? 'What are you working on?' : 'Objectives for this session...'}
                  value={activeNote}
                  onChange={(e) => setActiveNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-slate-900 focus:bg-white transition-colors"
                />
              </div>

              {/* Primary Clock Buttons (harmonized with main card design: rounded-xl, gradient & active session labels) */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 pt-0.5">
                {/* CLOCK IN BUTTON */}
                <button
                  type="button"
                  id="drawer-clock-in-btn"
                  onClick={() => handlePunchClick('IN')}
                  disabled={isPunchedIn}
                  className={`p-3.5 sm:p-4 rounded-xl flex items-center gap-2.5 sm:gap-3 transition-all duration-150 text-left shadow-2xs min-h-[56px] ${
                    isPunchedIn
                      ? 'text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed opacity-80'
                      : 'text-white bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:scale-[0.98] shadow-emerald-700/20 border border-emerald-500 cursor-pointer'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${isPunchedIn ? 'bg-slate-200 text-slate-400' : 'bg-emerald-500/40 text-white'}`}>
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-extrabold tracking-wide uppercase truncate">
                      {isPunchedIn ? 'CLOCKED IN' : 'CLOCK IN'}
                    </div>
                    <div className={`text-[10px] truncate ${isPunchedIn ? 'text-slate-500' : 'text-emerald-100'}`}>
                      {isPunchedIn ? 'Active session' : 'Start session'}
                    </div>
                  </div>
                </button>

                {/* CLOCK OUT BUTTON */}
                <button
                  type="button"
                  id="drawer-clock-out-btn"
                  onClick={() => handlePunchClick('OUT')}
                  disabled={!isPunchedIn}
                  className={`p-3.5 sm:p-4 rounded-xl flex items-center gap-2.5 sm:gap-3 transition-all duration-150 text-left shadow-2xs min-h-[56px] ${
                    !isPunchedIn
                      ? 'text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed opacity-80'
                      : 'text-white bg-gradient-to-b from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:scale-[0.98] shadow-rose-700/20 border border-rose-500 cursor-pointer'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${!isPunchedIn ? 'bg-slate-200 text-slate-400' : 'bg-rose-500/40 text-white'}`}>
                    <Square className="w-4 h-4 fill-current" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-extrabold tracking-wide uppercase truncate">
                      CLOCK OUT
                    </div>
                    <div className={`text-[10px] truncate ${!isPunchedIn ? 'text-slate-500' : 'text-rose-100'}`}>
                      {isPunchedIn ? 'End & save' : 'Currently out'}
                    </div>
                  </div>
                </button>
              </div>

              {/* Today's Mini Summary */}
              {activeSessionsCount > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Today's Sessions ({activeSessionsCount})</span>
                    {lastPunchTime && (
                      <span className="text-[10px] font-mono text-slate-400 font-normal lowercase">
                        last: {formatTime24to12(lastPunchTime)}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                    {punches.slice(0, 3).map((p, idx) => (
                      <div key={idx} className="text-xs flex items-center justify-between py-1 px-2.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-700">
                        <span className="font-mono font-medium text-[11px]">
                          {p.inTime ? formatTime24to12(p.inTime) : '--:--'} – {p.outTime ? formatTime24to12(p.outTime) : (isPunchedIn && idx === punches.length - 1 ? 'Now' : '--:--')}
                        </span>
                        {p.projectName && (
                          <ProjectBadge
                            name={p.projectName}
                            color={projects.find(proj => proj.name === p.projectName)?.color || '#64748b'}
                            size="sm"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modern Confirmation Dialog */}
      <ConfirmModal
        options={confirmDialog}
        onClose={() => setConfirmDialog(null)}
        themeColor={themeColor}
      />
    </>
  );
}
