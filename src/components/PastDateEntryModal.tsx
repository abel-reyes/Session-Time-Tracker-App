import { useState, useEffect } from 'react';
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
  FileText
} from 'lucide-react';
import { DayRecord, PunchPair, Project } from '../types';
import { 
  formatDateToYYYYMMDD, 
  formatDateMMDDYYYY,
  getDurationInSeconds, 
  formatSecondsToHuman,
  formatSecondsToHHMMSS,
  calculateDayTotalSeconds,
  splitMultiDaySession
} from '../utils/timeCalculations';
import { ProjectBadge } from './ProjectBadge';

interface PastDateEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
  records: DayRecord[];
  projects?: Project[];
  onSaveDayRecord: (updatedRecord: DayRecord) => void;
  onSaveMultipleRecords?: (records: DayRecord[]) => void;
  themeColor?: string;
  secondaryColor?: string;
}

export function PastDateEntryModal({
  isOpen,
  onClose,
  initialDate,
  records,
  projects = [],
  onSaveDayRecord,
  onSaveMultipleRecords,
  themeColor = '#0284C7',
  secondaryColor = '#0F172A',
}: PastDateEntryModalProps) {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (initialDate) return initialDate;
    return formatDateToYYYYMMDD(new Date());
  });

  const [currentPunches, setCurrentPunches] = useState<PunchPair[]>([]);
  const [dayNotes, setDayNotes] = useState<string>('');
  
  // New session input fields (supports multi-day and overnight shifts)
  const [newEndDate, setNewEndDate] = useState<string>(() => {
    if (initialDate) return initialDate;
    return formatDateToYYYYMMDD(new Date());
  });
  const [newInTime, setNewInTime] = useState<string>('09:00:00');
  const [newOutTime, setNewOutTime] = useState<string>('17:00:00');
  const [newProjectId, setNewProjectId] = useState<string>(projects[0]?.id || '');
  const [newNote, setNewNote] = useState<string>('');
  
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const d = initialDate || formatDateToYYYYMMDD(new Date());
      setSelectedDate(d);
      setNewEndDate(d);
    }
  }, [isOpen, initialDate]);

  useEffect(() => {
    const existing = records.find((r) => r.date === selectedDate);
    if (existing && existing.punches) {
      const activePairs = existing.punches.filter((p) => Boolean(p.inTime || p.outTime));
      setCurrentPunches(activePairs.map((p) => ({ ...p })));
      setDayNotes(existing.notes || '');
    } else {
      setCurrentPunches([]);
      setDayNotes('');
    }
    setFormError(null);
  }, [selectedDate, records]);

  if (!isOpen) return null;

  const setDateByOffset = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    setSelectedDate(formatDateToYYYYMMDD(d));
  };

  const handleApplyPreset = (inT: string, outT: string) => {
    setNewInTime(inT);
    setNewOutTime(outT);
    setFormError(null);
  };

  const handleAddSession = () => {
    setFormError(null);
    if (!newInTime.trim()) {
      setFormError('Please provide a Start (Clock In) time.');
      return;
    }

    let formattedIn = newInTime.trim();
    if (formattedIn.length === 5) formattedIn += ':00';

    let formattedOut = newOutTime.trim();
    if (formattedOut.length === 5) formattedOut += ':00';

    const matchProj = projects.find((p) => p.id === newProjectId);

    if (newEndDate > selectedDate) {
      if (!formattedOut) {
        setFormError('Please provide an End (Clock Out) time for multi-day sessions.');
        return;
      }
      const dur = getDurationInSeconds(formattedIn, formattedOut, selectedDate, newEndDate);
      if (dur <= 0) {
        setFormError('End date/time must be strictly after Start date/time.');
        return;
      }

      const segments = splitMultiDaySession(
        selectedDate,
        formattedIn,
        newEndDate,
        formattedOut,
        newProjectId || undefined,
        matchProj?.name,
        newNote.trim() || undefined
      );

      // Add Day 1's segment to current day's punches
      setCurrentPunches([...currentPunches, segments[0].punch]);

      // If there are subsequent segments, save them across subsequent days
      if (onSaveMultipleRecords && segments.length > 1) {
        const recordsToUpdate: DayRecord[] = [];
        for (let i = 1; i < segments.length; i++) {
          const seg = segments[i];
          const existing = records.find((r) => r.date === seg.date);
          if (existing) {
            recordsToUpdate.push({
              ...existing,
              punches: [...(existing.punches || []), seg.punch],
            });
          } else {
            recordsToUpdate.push({
              date: seg.date,
              punches: [seg.punch],
            });
          }
        }
        onSaveMultipleRecords(recordsToUpdate);
      }
      setNewNote('');
    } else {
      if (formattedOut) {
        const dur = getDurationInSeconds(formattedIn, formattedOut);
        if (dur <= 0) {
          setFormError('End time must be after Start time.');
          return;
        }
      }

      const updated = [
        ...currentPunches,
        {
          inDate: selectedDate,
          inTime: formattedIn,
          outDate: selectedDate,
          outTime: formattedOut,
          projectId: newProjectId || undefined,
          projectName: matchProj?.name,
          note: newNote.trim() || undefined,
        },
      ];
      setCurrentPunches(updated);
      setNewNote('');
    }
  };

  const handleRemoveSession = (index: number) => {
    const targetPunch = currentPunches[index];
    const updated = currentPunches.filter((_, i) => i !== index);
    setCurrentPunches(updated);

    // Save update to current record immediately
    const cleanPunches = updated.filter((p) => Boolean(p.inTime?.trim() || p.outTime?.trim()));
    onSaveDayRecord({
      date: selectedDate,
      punches: cleanPunches,
      notes: dayNotes.trim() || undefined,
    });

    // If punch was part of a linked multi-day session, also clean up linked segments across other records
    if (targetPunch?.sessionId && onSaveMultipleRecords) {
      const recordsToUpdate: DayRecord[] = [];
      records.forEach((r) => {
        if (r.date !== selectedDate && r.punches?.some((p) => p.sessionId === targetPunch.sessionId)) {
          recordsToUpdate.push({
            ...r,
            punches: r.punches.filter((p) => p.sessionId !== targetPunch.sessionId),
          });
        }
      });
      if (recordsToUpdate.length > 0) {
        onSaveMultipleRecords(recordsToUpdate);
      }
    }
  };

  const handleSaveAll = () => {
    const cleanPunches = currentPunches.filter((p) => Boolean(p.inTime?.trim() || p.outTime?.trim()));
    const recordToSave: DayRecord = {
      date: selectedDate,
      punches: cleanPunches,
      notes: dayNotes.trim() || undefined,
    };

    onSaveDayRecord(recordToSave);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 500);
  };

  const dayTotalSec = calculateDayTotalSeconds(currentPunches);
  const newSessionSec = (newInTime && newOutTime) 
    ? getDurationInSeconds(newInTime, newOutTime, selectedDate, newEndDate) 
    : 0;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92dvh] sm:max-h-[90vh]">
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
              <h3 className="text-base font-bold text-slate-900">
                Log & Edit Past Sessions
              </h3>
              <p className="text-xs text-slate-500">
                Select any prior or custom date to view, add, or adjust time logs & projects
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
        <div className="p-6 space-y-5 overflow-y-auto text-xs text-slate-700">
          {/* Choose Date - Inline label and date selector */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <label 
              htmlFor="past-entry-date-picker"
              className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Calendar className="w-4 h-4" style={{ color: themeColor }} />
              Choose Date:
            </label>

            <div className="flex-1 sm:max-w-xs">
              <input
                id="past-entry-date-picker"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none cursor-pointer shadow-2xs"
              />
            </div>
          </div>

          {/* Existing Sessions for that date */}
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
                No working sessions logged for {formatDateMMDDYYYY(selectedDate)} yet. Use the form below to add one!
              </div>
            ) : (
              <div className="space-y-2">
                {currentPunches.map((punch, idx) => {
                  const pMatch = projects.find((p) => p.id === punch.projectId) || (punch.projectName ? { name: punch.projectName, color: '#6366f1' } : null);

                  return (
                    <div
                      key={idx}
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
                                const copy = [...currentPunches];
                                const selectedProj = projects.find((p) => p.id === e.target.value);
                                copy[idx].projectId = e.target.value || undefined;
                                copy[idx].projectName = selectedProj?.name;
                                setCurrentPunches(copy);
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

                      {/* Start / Stop times below */}
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <input
                          type="time"
                          step="1"
                          value={punch.inTime || ''}
                          onChange={(e) => {
                            const copy = [...currentPunches];
                            copy[idx].inTime = e.target.value;
                            setCurrentPunches(copy);
                          }}
                          className="border border-slate-200 rounded px-2 py-1 bg-slate-50 focus:bg-white text-emerald-800 font-semibold"
                        />
                        <span className="text-slate-400">to</span>
                        <input
                          type="time"
                          step="1"
                          value={punch.outTime || ''}
                          onChange={(e) => {
                            const copy = [...currentPunches];
                            copy[idx].outTime = e.target.value;
                            setCurrentPunches(copy);
                          }}
                          className="border border-slate-200 rounded px-2 py-1 bg-slate-50 focus:bg-white text-rose-800 font-semibold"
                        />
                      </div>

                      {/* Note annotation */}
                      <div className="pt-0.5">
                        <input
                          type="text"
                          placeholder="Add session note or accomplished objective..."
                          value={punch.note || ''}
                          onChange={(e) => {
                            const copy = [...currentPunches];
                            copy[idx].note = e.target.value;
                            setCurrentPunches(copy);
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

          {/* Add a New Session */}
          <div className="bg-teal-50/50 rounded-xl p-4 border border-teal-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-900 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-teal-700" />
                Add a Session to: {formatDateMMDDYYYY(selectedDate)}
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
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono focus:outline-teal-600"
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
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono focus:outline-teal-600"
                />
              </div>
            </div>

            {/* End Date selector (Supports multi-day journeys across calendar dates) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white/70 p-2.5 rounded-lg border border-teal-200/60">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                <span>Clock Out Date:</span>
                {newEndDate > selectedDate ? (
                  <span className="text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded text-[10px]">
                    🌙 Multi-Day ({formatDateMMDDYYYY(newEndDate)})
                  </span>
                ) : (
                  <span className="text-slate-500 font-normal">Same day</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setNewEndDate(selectedDate)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                    newEndDate === selectedDate ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Same Day
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(`${selectedDate}T00:00:00`);
                    d.setDate(d.getDate() + 1);
                    setNewEndDate(formatDateToYYYYMMDD(d));
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                    newEndDate !== selectedDate ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  +1 Day (Overnight)
                </button>
                <input
                  type="date"
                  min={selectedDate}
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  className="bg-white border border-slate-300 rounded px-2 py-0.5 text-[11px] font-mono font-semibold text-slate-800"
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
                  placeholder="e.g. Completed feature testing..."
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
              Overall Daily Notes & Objectives Summary
            </label>
            <textarea
              rows={2}
              placeholder="Summary of all objectives accomplished for this date..."
              value={dayNotes}
              onChange={(e) => setDayNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-300 rounded-xl focus:outline-none"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleSaveAll}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
            style={{ backgroundColor: themeColor }}
          >
            {saveSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{saveSuccess ? 'Saved Day Sessions!' : `Save All Sessions for ${formatDateMMDDYYYY(selectedDate)}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
