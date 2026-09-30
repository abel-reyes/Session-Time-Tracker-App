import { useState, useRef, useEffect, ChangeEvent, FormEvent } from 'react';
import { 
  FolderKanban, 
  Plus, 
  Trash2, 
  Edit3, 
  X, 
  Check, 
  Clock, 
  FileText, 
  Calendar,
  Layers,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Tag,
  Download,
  Upload,
  ChevronDown,
  ChevronUp,
  Calculator,
  Copy,
  RotateCcw,
  FileSpreadsheet,
  Filter
} from 'lucide-react';
import { Project, DayRecord, PunchPair } from '../types';
import { 
  formatSecondsToHuman, 
  formatSecondsToHHMMSS, 
  formatDateMMDDYYYY, 
  formatDateToYYYYMMDD,
  formatTime24to12,
  getDurationInSeconds,
  parseCSVToRecordsAndProjects,
  deleteSessionFromRecords,
  normalizeTimeToHHMMSS
} from '../utils/timeCalculations';
import { recordDeletedSession } from '../utils/storage';
import { ConfirmModal, ConfirmDialogOptions } from './ConfirmModal';
import { EmptyState } from './EmptyState';

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  records: DayRecord[];
  onSaveProjects: (projects: Project[]) => void;
  onSaveRecords?: (records: DayRecord[]) => void;
  onSelectProjectForSession?: (projectId: string) => void;
  themeColor?: string;
  secondaryColor?: string;
}

const PRESET_COLORS = [
  '#0284C7', // Ocean
  '#15803D', // Forest
  '#8B5CF6', // Berry
  '#450084', // Dukes
  '#D97706', // Eclipse
  '#D65467', // Sumac
  '#D44B2E', // Sunset
  '#C2410C', // Copper
  '#1D4ED8', // Cobalt
  '#0F172A', // Midnight
  '#0D9488', // Teal
  '#38511D', // Olive
];

export function ProjectsModal({
  isOpen,
  onClose,
  projects,
  records,
  onSaveProjects,
  onSaveRecords,
  onSelectProjectForSession,
  themeColor = '#059669',
  secondaryColor = '#0F172A',
}: ProjectsModalProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projects[0]?.id || null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogOptions | null>(null);

  // Form State
  const [name, setName] = useState<string>('');
  const [client, setClient] = useState<string>('');
  const [billableRate, setBillableRate] = useState<string>('');
  const [color, setColor] = useState<string>(PRESET_COLORS[0]);
  const [description, setDescription] = useState<string>('');
  const [isCsvMenuOpen, setIsCsvMenuOpen] = useState<boolean>(false);

  // Log Punch Editing State
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editLogDate, setEditLogDate] = useState<string>('');
  const [editLogInTime, setEditLogInTime] = useState<string>('');
  const [editLogOutTime, setEditLogOutTime] = useState<string>('');
  const [editLogProjectId, setEditLogProjectId] = useState<string>('');
  const [editLogNote, setEditLogNote] = useState<string>('');

  // Date Range Aggregation & Billing Filter State
  const [isAggregatorExpanded, setIsAggregatorExpanded] = useState<boolean>(false);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState<boolean>(false);
  const [rangePreset, setRangePreset] = useState<'all' | 'this-month' | 'last-month' | 'this-quarter' | 'last-30' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [copiedInvoice, setCopiedInvoice] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const prevIsOpenRef = useRef<boolean>(false);

  // Default Billing Calculator to closed only when the projects window opens from a closed state.
  // When switching between projects while the window remains open, keep the user's expanded state.
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setIsAggregatorExpanded(false);
      setIsFiltersExpanded(false);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  if (!isOpen) return null;

  // Calculate project statistics from all records
  const projectStats = projects.map((p) => {
    let totalSec = 0;
    const sessionLogs: {
      id: string;
      date: string;
      punchIndex: number;
      punch: PunchPair;
      inTime?: string;
      outTime?: string;
      durationSec: number;
      note?: string;
    }[] = [];

    records.forEach((r) => {
      (r.punches || []).forEach((punch, pIdx) => {
        if (punch.projectId === p.id || punch.projectName === p.name) {
          let dur = 0;
          if (punch.inTime && punch.outTime) {
            dur = getDurationInSeconds(punch.inTime, punch.outTime, punch.inDate, punch.outDate);
          }
          totalSec += dur;
          sessionLogs.push({
            id: `${r.date}-${pIdx}-${punch.inTime || 'open'}`,
            date: r.date,
            punchIndex: pIdx,
            punch,
            inTime: punch.inTime,
            outTime: punch.outTime,
            durationSec: dur,
            note: punch.note || r.notes,
          });
        }
      });
    });

    return {
      project: p,
      totalSeconds: totalSec,
      totalHours: (totalSec / 3600).toFixed(1),
      sessionCount: sessionLogs.length,
      logs: sessionLogs.sort((a, b) => {
        const dateDiff = b.date.localeCompare(a.date);
        if (dateDiff !== 0) return dateDiff;
        return (b.inTime || '').localeCompare(a.inTime || '');
      }),
    };
  });

  const totalAllProjectSeconds = projectStats.reduce((acc, curr) => acc + curr.totalSeconds, 0);

  const handleStartCreate = () => {
    setName('');
    setClient('');
    setBillableRate('');
    setColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
    setDescription('');
    setIsCreating(true);
    setEditingProjectId(null);
  };

  const handleStartEdit = (p: Project) => {
    setName(p.name);
    setClient(p.client || '');
    setBillableRate(p.billableRate !== undefined && p.billableRate !== null ? String(p.billableRate) : '');
    setColor(p.color || PRESET_COLORS[0]);
    setDescription(p.description || '');
    setEditingProjectId(p.id);
    setIsCreating(false);
  };

  const handleSaveForm = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please enter a project name.');
      return;
    }

    const parsedRate = billableRate.trim() ? parseFloat(billableRate) : 0;
    const validRate = !isNaN(parsedRate) && parsedRate >= 0 ? parsedRate : 0;

    if (isCreating) {
      const nowIso = new Date().toISOString();
      const newProj: Project = {
        id: `proj-${Date.now()}`,
        name: name.trim(),
        client: client.trim() || undefined,
        billableRate: validRate,
        color,
        description: description.trim() || undefined,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const updated = [...projects, newProj];
      onSaveProjects(updated);
      setSelectedProjectId(newProj.id);
      setIsCreating(false);
    } else if (editingProjectId) {
      const nowIso = new Date().toISOString();
      const updated = projects.map((p) =>
        p.id === editingProjectId
          ? {
              ...p,
              name: name.trim(),
              client: client.trim() || undefined,
              billableRate: validRate,
              color,
              description: description.trim() || undefined,
              updatedAt: nowIso,
            }
          : p
      );
      onSaveProjects(updated);
      setEditingProjectId(null);
    }
  };

  // Session Log Punch Editing Handlers within Projects Modal
  const handleStartEditPunch = (log: {
    id: string;
    date: string;
    punchIndex: number;
    punch: PunchPair;
    inTime?: string;
    outTime?: string;
    note?: string;
  }) => {
    setEditingLogId(log.id);
    setEditLogDate(log.date);
    setEditLogInTime(log.inTime ? log.inTime.substring(0, 8) : '');
    setEditLogOutTime(log.outTime ? log.outTime.substring(0, 8) : '');
    setEditLogProjectId(log.punch.projectId || selectedProjectId || '');
    setEditLogNote(log.note || '');
  };

  const handleCancelEditPunch = () => {
    setEditingLogId(null);
  };

  const handleSavePunchEdit = (log: {
    date: string;
    punchIndex: number;
    punch: PunchPair;
  }) => {
    if (!onSaveRecords) return;
    const updated = [...records];
    const oldRecIdx = updated.findIndex((r) => r.date === log.date);
    if (oldRecIdx === -1) return;

    const formattedIn = editLogInTime.trim() ? normalizeTimeToHHMMSS(editLogInTime.trim()) : '';
    const formattedOut = editLogOutTime.trim() ? normalizeTimeToHHMMSS(editLogOutTime.trim()) : '';

    const targetProj = projects.find((p) => p.id === editLogProjectId);
    const updatedPunch: PunchPair = {
      ...log.punch,
      inDate: editLogDate,
      inTime: formattedIn,
      outDate: editLogDate,
      outTime: formattedOut,
      projectId: targetProj ? targetProj.id : undefined,
      projectName: targetProj ? targetProj.name : undefined,
      note: editLogNote.trim() || undefined,
    };

    if (editLogDate === log.date) {
      // Same date: update in place
      const oldRec = { ...updated[oldRecIdx] };
      const punchesCopy = [...(oldRec.punches || [])];
      punchesCopy[log.punchIndex] = updatedPunch;
      oldRec.punches = punchesCopy;
      updated[oldRecIdx] = oldRec;
    } else {
      // Date changed: remove from old date, insert into new date
      const oldRec = { ...updated[oldRecIdx] };
      oldRec.punches = (oldRec.punches || []).filter((_, idx) => idx !== log.punchIndex);
      updated[oldRecIdx] = oldRec;

      const newRecIdx = updated.findIndex((r) => r.date === editLogDate);
      if (newRecIdx >= 0) {
        const newRec = { ...updated[newRecIdx] };
        newRec.punches = [...(newRec.punches || []), updatedPunch];
        updated[newRecIdx] = newRec;
      } else {
        updated.push({
          date: editLogDate,
          punches: [updatedPunch],
        });
      }
      updated.sort((a, b) => a.date.localeCompare(b.date));
    }

    onSaveRecords(updated);
    setEditingLogId(null);
  };

  const handleDeletePunch = (log: {
    date: string;
    punchIndex: number;
    punch: PunchPair;
    inTime?: string;
    outTime?: string;
  }) => {
    if (!onSaveRecords) return;
    setConfirmDialog({
      title: 'Delete Recorded Punch?',
      message: `Are you sure you want to delete this punch session on ${formatDateMMDDYYYY(log.date)}${log.inTime ? ` (${formatTime24to12(log.inTime)} – ${log.outTime ? formatTime24to12(log.outTime) : 'Open'})` : ''}? This will remove the punch from timesheets and immediately update project statistics.`,
      confirmText: 'Delete Punch',
      variant: 'danger',
      onConfirm: () => {
        recordDeletedSession(log.punch, log.date);
        const updated = deleteSessionFromRecords(records, log.date, log.punch, log.punchIndex);
        onSaveRecords(updated);
        setEditingLogId(null);
      },
    });
  };

  const handleDeleteProject = (projId: string) => {
    const target = projects.find((p) => p.id === projId);
    setConfirmDialog({
      title: `Delete "${target?.name || 'Project'}"?`,
      message: 'Are you sure you want to delete this project? Existing session timestamps will keep their logged records.',
      confirmText: 'Delete Project',
      variant: 'danger',
      onConfirm: () => {
        const nowIso = new Date().toISOString();
        const updated = projects.map((p) =>
          p.id === projId
            ? {
                ...p,
                isDeleted: true,
                deletedAt: nowIso,
                updatedAt: nowIso,
              }
            : p
        );
        onSaveProjects(updated);
        const remaining = updated.filter((p) => !p.isDeleted);
        if (selectedProjectId === projId) {
          setSelectedProjectId(remaining[0]?.id || null);
        }
      },
    });
  };

  const handleExportProjectsCSV = () => {
    const activeProjects = projects.filter((p) => !p.isDeleted);
    const rows = [
      '# PROJECTS_SECTION',
      '# Project Name,Client,Billable Rate,Color Hex,Description,Project ID',
    ];
    for (const p of activeProjects) {
      const nameSafe = (p.name || '').replace(/"/g, '""');
      const clientSafe = (p.client || '').replace(/"/g, '""');
      const rateSafe = p.billableRate !== undefined && p.billableRate !== null ? String(p.billableRate) : '';
      const colorSafe = (p.color || '#0284C7').replace(/"/g, '""');
      const descSafe = (p.description || '').replace(/"/g, '""');
      const idSafe = (p.id || '').replace(/"/g, '""');
      rows.push(`# "${nameSafe}","${clientSafe}","${rateSafe}","${colorSafe}","${descSafe}","${idSafe}"`);
    }
    rows.push('# END_PROJECTS_SECTION');
    rows.push('');
    rows.push('Project Name,Client,Billable Rate ($/hr),Color,Description,Total Hours,Total Sessions,Billable Total ($)');
    for (const ps of projectStats) {
      if (ps.project.isDeleted) continue;
      const p = ps.project;
      const nameSafe = (p.name || '').replace(/"/g, '""');
      const clientSafe = (p.client || '').replace(/"/g, '""');
      const rateSafe = p.billableRate !== undefined && p.billableRate !== null ? String(p.billableRate) : '';
      const colorSafe = (p.color || '').replace(/"/g, '""');
      const descSafe = (p.description || '').replace(/"/g, '""');
      const billableTot = p.billableRate && p.billableRate > 0 ? ((ps.totalSeconds / 3600) * p.billableRate).toFixed(2) : '';
      rows.push(`"${nameSafe}","${clientSafe}","${rateSafe}","${colorSafe}","${descSafe}",${ps.totalHours},${ps.sessionCount},"${billableTot}"`);
    }

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Projects_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleImportProjectsCSV = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const { projects: parsedProjects } = parseCSVToRecordsAndProjects(text, projects);
        
        // If no projects parsed via metadata, try parsing standard 2-4 column CSV rows
        let finalProjects = [...parsedProjects];
        if (finalProjects.length === 0) {
          const lines = text.trim().split(/\r?\n/);
          for (const line of lines) {
            const raw = line.trim();
            if (!raw || raw.startsWith('#') || raw.toLowerCase().startsWith('project name')) continue;
            const parts = raw.split(',').map((c) => c.replace(/^["']|["']$/g, '').trim());
            if (parts[0]) {
              finalProjects.push({
                id: `proj-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                name: parts[0],
                client: parts[1] || undefined,
                color: parts[2] && parts[2].startsWith('#') ? parts[2] : '#0284C7',
                description: parts[3] || undefined,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }
          }
        }

        if (finalProjects.length === 0) {
          alert('Could not detect any valid project information from this CSV.');
          return;
        }

        const existingMap = new Map<string, Project>();
        projects.forEach((p) => existingMap.set(p.name.toLowerCase().trim(), p));

        let addedCount = 0;
        const merged = [...projects];
        for (const np of finalProjects) {
          const key = np.name.toLowerCase().trim();
          if (!existingMap.has(key)) {
            merged.push(np);
            existingMap.set(key, np);
            addedCount++;
          }
        }

        onSaveProjects(merged);
        alert(`Successfully imported ${addedCount} new project(s)!`);
      } catch (err) {
        alert('Error importing projects CSV: ' + String(err));
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const activeStats = projectStats.find((ps) => ps.project.id === selectedProjectId) || projectStats[0];

  const applyPreset = (preset: 'all' | 'this-month' | 'last-month' | 'this-quarter' | 'last-30' | 'custom') => {
    setRangePreset(preset);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'this-month') {
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      setStartDate(formatDateToYYYYMMDD(start));
      setEndDate(formatDateToYYYYMMDD(end));
    } else if (preset === 'last-month') {
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      setStartDate(formatDateToYYYYMMDD(start));
      setEndDate(formatDateToYYYYMMDD(end));
    } else if (preset === 'this-quarter') {
      const q = Math.floor(m / 3);
      const start = new Date(y, q * 3, 1);
      const end = new Date(y, (q + 1) * 3, 0);
      setStartDate(formatDateToYYYYMMDD(start));
      setEndDate(formatDateToYYYYMMDD(end));
    } else if (preset === 'last-30') {
      const past = new Date(now);
      past.setDate(past.getDate() - 30);
      setStartDate(formatDateToYYYYMMDD(past));
      setEndDate(formatDateToYYYYMMDD(now));
    }
  };

  const handleClearRange = () => {
    applyPreset('all');
  };

  const hasBillableRate = Boolean(activeStats?.project.billableRate && activeStats.project.billableRate > 0);
  const isRangeActive = Boolean(hasBillableRate && (startDate || endDate));
  const isInvalidRange = Boolean(startDate && endDate && startDate > endDate);

  // Active project logs filtered by date range
  const activeLogs = activeStats?.logs || [];
  const filteredRangeLogs = activeLogs.filter((log) => {
    if (startDate && log.date < startDate) return false;
    if (endDate && log.date > endDate) return false;
    return true;
  });

  const rangeTotalSeconds = isRangeActive
    ? filteredRangeLogs.reduce((sum, log) => sum + log.durationSec, 0)
    : activeStats?.totalSeconds || 0;

  const rangeTotalHours = rangeTotalSeconds / 3600;
  const rangeSessionCount = isRangeActive ? filteredRangeLogs.length : activeStats?.sessionCount || 0;
  const activeRate = activeStats?.project.billableRate || 0;
  const rangeBillableTotal = activeRate > 0 ? (rangeTotalHours * activeRate) : 0;
  const rangeDistinctDaysCount = new Set(filteredRangeLogs.map((l) => l.date)).size;

  const handleCopyInvoiceSummary = () => {
    if (!activeStats) return;
    const proj = activeStats.project;
    const rangeLabel = startDate && endDate
      ? `${formatDateMMDDYYYY(startDate)} – ${formatDateMMDDYYYY(endDate)}`
      : startDate
      ? `From ${formatDateMMDDYYYY(startDate)}`
      : endDate
      ? `Through ${formatDateMMDDYYYY(endDate)}`
      : 'All Time';

    const lines = [
      `INVOICE & BILLING SUMMARY`,
      `----------------------------------------`,
      `Project: ${proj.name}${proj.client ? ` (Client: ${proj.client})` : ''}`,
      `Billing Period: ${rangeLabel}`,
      `Total Hours: ${rangeTotalHours.toFixed(2)} hrs (${formatSecondsToHuman(rangeTotalSeconds)})`,
      `Billable Rate: ${activeRate > 0 ? `$${activeRate.toFixed(2)}/hr` : 'Not set ($0.00/hr)'}`,
      activeRate > 0 ? `Total Amount Due: $${rangeBillableTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null,
      `Punches Logged: ${rangeSessionCount} sessions across ${rangeDistinctDaysCount} days`,
      `----------------------------------------`,
      ``,
      `ITEMIZED SESSIONS:`,
      ...filteredRangeLogs.map((l) => {
        const timeSpan = l.inTime && l.outTime ? `${formatTime24to12(l.inTime)} – ${formatTime24to12(l.outTime)}` : 'Recorded';
        const dur = formatSecondsToHuman(l.durationSec);
        const hours = (l.durationSec / 3600).toFixed(2);
        const subtotal = activeRate > 0 ? ` ($${((l.durationSec / 3600) * activeRate).toFixed(2)})` : '';
        const note = l.note ? ` | Note: ${l.note}` : '';
        return `• ${formatDateMMDDYYYY(l.date)} | ${timeSpan} | ${dur} (${hours}h)${subtotal}${note}`;
      }),
    ].filter((line) => line !== null);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedInvoice(true);
    setTimeout(() => setCopiedInvoice(false), 2200);
  };

  const handleExportRangeCSV = () => {
    if (!activeStats) return;
    const proj = activeStats.project;
    const rangeLabel = startDate && endDate
      ? `${startDate}_to_${endDate}`
      : startDate
      ? `from_${startDate}`
      : endDate
      ? `to_${endDate}`
      : 'all_time';

    const rows = [
      `# INVOICE & BILLING SUMMARY`,
      `# Project: "${(proj.name || '').replace(/"/g, '""')}"`,
      proj.client ? `# Client: "${proj.client.replace(/"/g, '""')}"` : null,
      `# Date Range: "${startDate || 'Beginning'} to ${endDate || 'Present'}"`,
      `# Total Hours: ${rangeTotalHours.toFixed(2)}`,
      `# Total Seconds: ${rangeTotalSeconds}`,
      activeRate > 0 ? `# Billable Rate: $${activeRate.toFixed(2)}/hr` : null,
      activeRate > 0 ? `# Total Amount Due: $${rangeBillableTotal.toFixed(2)}` : null,
      `# Sessions Count: ${rangeSessionCount}`,
      `# Exported: ${new Date().toISOString()}`,
      ``,
      `Date,Time In,Time Out,Duration (Seconds),Duration (Formatted),Duration (Hours),Billable Rate ($/hr),Subtotal ($),Notes & Objectives`,
      ...filteredRangeLogs.map((l) => {
        const dateFormatted = formatDateMMDDYYYY(l.date);
        const inT = l.inTime ? formatTime24to12(l.inTime) : '';
        const outT = l.outTime ? formatTime24to12(l.outTime) : '';
        const durSec = l.durationSec;
        const durFormatted = formatSecondsToHuman(durSec);
        const durH = (durSec / 3600).toFixed(2);
        const rateStr = activeRate > 0 ? activeRate.toFixed(2) : '0.00';
        const subtotal = activeRate > 0 ? ((durSec / 3600) * activeRate).toFixed(2) : '0.00';
        const noteClean = (l.note || '').replace(/"/g, '""');
        return `"${dateFormatted}","${inT}","${outT}",${durSec},"${durFormatted}",${durH},"${rateStr}","${subtotal}","${noteClean}"`;
      }),
    ].filter((r) => r !== null);

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${proj.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_Billing_${rangeLabel}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-5xl w-full my-auto max-h-[92dvh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-200 bg-slate-50 shrink-0 space-y-2">
          {/* Top Line: Title on Left, X in Top Right Corner */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div 
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-white flex items-center justify-center shadow-xs transition-colors shrink-0"
                style={{ backgroundColor: themeColor }}
              >
                <FolderKanban className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                Project & Objectives Tracker
              </h3>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Note across the screen under title */}
          <p className="text-[11px] sm:text-xs text-slate-500">
            Track specific time per project, categorize sessions, and annotate session accomplishments
          </p>

          {/* Action buttons: New Project and Unified CSV Caret Dropdown */}
          <div className="pt-0.5 flex items-center gap-2 flex-wrap">
            <button
              onClick={handleStartCreate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-2xs transition-colors cursor-pointer"
              style={{ backgroundColor: themeColor }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>

            {/* Unified CSV Caret Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCsvMenuOpen(!isCsvMenuOpen)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                title="CSV Import and Export options"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>CSV</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isCsvMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isCsvMenuOpen && (
                <div className="absolute left-0 mt-1.5 w-40 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-fadeIn">
                  <button
                    type="button"
                    onClick={() => {
                      handleExportProjectsCSV();
                      setIsCsvMenuOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Export CSV</span>
                  </button>

                  <label className="w-full px-3 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                    <span>Import CSV</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        handleImportProjectsCSV(e);
                        setIsCsvMenuOpen(false);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content Body: Full-Width Workflow when Creating, or Master-Detail Layout */}
        {isCreating ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-7 bg-white">
            <div className="max-w-xl mx-auto space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2.5">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-2xs"
                    style={{ backgroundColor: themeColor }}
                  >
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-slate-900">
                      Create New Project
                    </h4>
                    <p className="text-xs text-slate-500">
                      Configure your project name, client, color tag, and scope
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Back to List
                </button>
              </div>

              <form onSubmit={handleSaveForm} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. Client Operations, Website Redesign, Sprint 4..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:outline-slate-900 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Client / Department (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Corp, Engineering, Internal..."
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-300 focus:outline-slate-900 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Billable Rate (Optional)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00 / hr"
                      value={billableRate}
                      onChange={(e) => setBillableRate(e.target.value)}
                      className="w-full pl-7 pr-12 py-2 text-xs rounded-lg border border-slate-300 focus:outline-slate-900 shadow-2xs font-mono font-medium"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">/ hr</span>
                  </div>
                </div>

                {/* Project Color Customizer with Wheel, Hex, and Swatches */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">
                      Project Accent Color
                    </label>
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-800 shadow-2xs">
                      {color}
                    </span>
                  </div>

                  {/* Swatches */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-7 h-7 rounded-full transition-transform cursor-pointer shadow-2xs ${
                          color.toLowerCase() === c.toLowerCase() ? 'scale-125 ring-2 ring-slate-900 ring-offset-2' : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>

                  {/* Color Wheel & Hex code input */}
                  <div className="flex items-center gap-2.5 pt-1 border-t border-slate-200/70">
                    <input
                      type="color"
                      value={color.startsWith('#') ? color : '#059669'}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-9 h-9 p-0.5 rounded-lg border border-slate-300 cursor-pointer bg-white"
                      title="Open color wheel"
                    />
                    <div className="flex-1 flex items-center bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
                      <span className="text-slate-400 font-mono mr-1.5 font-bold">#</span>
                      <input
                        type="text"
                        maxLength={7}
                        placeholder="059669"
                        value={color.replace(/^#/, '')}
                        onChange={(e) => {
                          const val = e.target.value.trim().replace(/[^0-9a-fA-F]/g, '');
                          if (val.length <= 6) {
                            setColor('#' + val);
                          }
                        }}
                        className="w-full text-xs font-mono font-bold text-slate-900 uppercase outline-none"
                      />
                    </div>
                    <div
                      className="w-9 h-9 rounded-lg border border-slate-300 shadow-2xs shrink-0"
                      style={{ backgroundColor: color }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Description & Scope Objectives
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe deliverables, key metrics, or standard objectives for this project..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-300 focus:outline-slate-900 shadow-2xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg text-xs font-bold text-white shadow-2xs cursor-pointer flex items-center gap-1.5 transition-transform active:scale-95"
                    style={{ backgroundColor: themeColor }}
                  >
                    <Check className="w-4 h-4" />
                    <span>Create Project</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
        <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          {/* Left Column: Projects List (Desktop only, on mobile replaced by top dropdown selector) */}
          <div className="hidden md:block md:col-span-5 p-4 overflow-y-auto max-h-[40vh] md:max-h-none space-y-2.5 bg-slate-50/50">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1 flex items-center justify-between">
              <span>All Projects ({projects.filter((p) => !p.isDeleted).length})</span>
              <span>Total Logged</span>
            </div>

            {projects.filter((p) => !p.isDeleted).length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-slate-300 p-2">
                <EmptyState
                  icon={FolderKanban}
                  title="No Projects Added Yet"
                  description="Create custom projects to tag sessions, monitor objectives, and categorize working hours."
                  compact
                  action={{
                    label: 'Create First Project',
                    onClick: handleStartCreate,
                  }}
                />
              </div>
            ) : (
              projectStats.filter((item) => !item.project.isDeleted).map((item) => {
                const isSelected = selectedProjectId === item.project.id;
                const percentOfTotal = totalAllProjectSeconds > 0
                  ? Math.round((item.totalSeconds / totalAllProjectSeconds) * 100)
                  : 0;

                return (
                  <div
                    key={item.project.id}
                    onClick={() => {
                      setSelectedProjectId(item.project.id);
                      setIsCreating(false);
                      setEditingProjectId(null);
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white border-blue-300 shadow-sm ring-1 ring-blue-200'
                        : 'bg-white/80 border-slate-200/80 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                          style={{ backgroundColor: item.project.color || '#059669' }}
                        />
                        <div className="truncate">
                          <h4 className="text-xs font-bold text-slate-900 truncate">
                            {item.project.name}
                          </h4>
                          {item.project.client && (
                            <span className="text-[10px] text-slate-500 font-medium">
                              {item.project.client}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-extrabold font-mono text-slate-900">
                          {item.totalHours}h
                        </div>
                        <div className="text-[10px] font-semibold text-slate-400">
                          {percentOfTotal}%
                        </div>
                      </div>
                    </div>

                    {/* Mini progress track */}
                    <div className="w-full h-1 rounded-full bg-slate-100 mt-2.5 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${percentOfTotal}%`,
                          backgroundColor: item.project.color || '#059669',
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column / Mobile Full Column: Project Details, Edit Form, or Objectives & Notes History */}
          <div className="md:col-span-7 p-4 sm:p-5 overflow-y-auto space-y-4 bg-white">
            {/* Mobile Project Dropdown Selector at the top of the scrollable section */}
            {projects.filter((p) => !p.isDeleted).length > 0 && !isCreating && !editingProjectId && (
              <div className="md:hidden p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 shadow-2xs">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FolderKanban className="w-3.5 h-3.5" style={{ color: themeColor }} />
                    Select Project:
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {projects.filter((p) => !p.isDeleted).length} active
                  </span>
                </label>
                <select
                  value={selectedProjectId || ''}
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value);
                    setIsCreating(false);
                    setEditingProjectId(null);
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 shadow-2xs cursor-pointer"
                >
                  {projects.filter((p) => !p.isDeleted).map((p) => {
                    const pStats = projectStats.find((ps) => ps.project.id === p.id);
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.client ? `(${p.client})` : ''} — {pStats ? `${pStats.totalHours}h` : '0h'} ({pStats?.sessionCount || 0} sessions)
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {projects.filter((p) => !p.isDeleted).length === 0 && (
              <div className="md:hidden bg-slate-50 rounded-xl border border-dashed border-slate-300 p-2">
                <EmptyState
                  icon={FolderKanban}
                  title="No Projects Added Yet"
                  description="Create custom projects to tag sessions and objectives."
                  compact
                  action={{
                    label: 'Create First Project',
                    onClick: handleStartCreate,
                  }}
                />
              </div>
            )}
            {isCreating || editingProjectId ? (
              /* Create / Edit Form */
              <form onSubmit={handleSaveForm} className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-indigo-600" />
                    {isCreating ? 'Create New Project' : 'Edit Project Details'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setEditingProjectId(null);
                    }}
                    className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Website Redesign, Client Marketing..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Client / Department
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Corp, Internal..."
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Billable Rate (Optional)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00 / hr"
                      value={billableRate}
                      onChange={(e) => setBillableRate(e.target.value)}
                      className="w-full pl-7 pr-12 py-2 text-xs rounded-lg border border-slate-300 focus:outline-slate-900 font-mono font-medium"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">/ hr</span>
                  </div>
                </div>

                {/* Project Color Customizer with Wheel, Hex, and Swatches */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">
                      Project Accent Color
                    </label>
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                      {color}
                    </span>
                  </div>

                  {/* Swatches */}
                  <div className="flex flex-wrap items-center gap-2">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-6 h-6 rounded-full transition-transform cursor-pointer shadow-2xs ${
                          color.toLowerCase() === c.toLowerCase() ? 'scale-125 ring-2 ring-slate-800 ring-offset-1' : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>

                  {/* Color Wheel & Hex code input */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
                    <input
                      type="color"
                      value={color.startsWith('#') ? color : '#059669'}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-8 h-8 p-0.5 rounded-lg border border-slate-300 cursor-pointer bg-white"
                      title="Open color wheel"
                    />
                    <div className="flex-1 flex items-center bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                      <span className="text-slate-400 font-mono mr-1">#</span>
                      <input
                        type="text"
                        maxLength={7}
                        placeholder="059669"
                        value={color.replace(/^#/, '')}
                        onChange={(e) => {
                          const val = e.target.value.trim().replace(/[^0-9a-fA-F]/g, '');
                          if (val.length <= 6) {
                            setColor('#' + val);
                          }
                        }}
                        className="w-full text-xs font-mono font-bold text-slate-900 uppercase outline-none"
                      />
                    </div>
                    <div
                      className="w-8 h-8 rounded-lg border border-slate-300 shadow-2xs shrink-0"
                      style={{ backgroundColor: color }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Description & Objectives Scope
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe deliverables, key metrics, or standard objectives for this project..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-slate-900"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg text-xs font-bold text-white shadow-xs cursor-pointer flex items-center gap-1"
                    style={{ backgroundColor: themeColor }}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isCreating ? 'Create Project' : 'Save Changes'}</span>
                  </button>
                </div>
              </form>
            ) : activeStats ? (
              /* Project Detailed View & Objectives Logs */
              <div className="space-y-4">
                {/* Project Header Card */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-4 h-4 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: activeStats.project.color || '#059669' }}
                    />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        {activeStats.project.name}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {activeStats.project.client ? `Client: ${activeStats.project.client} • ` : ''}
                        {activeStats.sessionCount} logged punches
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStartEdit(activeStats.project)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 border border-slate-200 bg-white transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteProject(activeStats.project.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 bg-white transition-colors cursor-pointer"
                      title="Delete project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {activeStats.project.description && (
                  <p className="text-xs text-slate-600 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
                    {activeStats.project.description}
                  </p>
                )}

                {/* Billing Calculator by Date (Collapsible Dropdown - Only shown if billableRate > 0) */}
                {hasBillableRate && (
                  <div className="rounded-xl bg-slate-50/90 border border-slate-200/90 shadow-2xs overflow-hidden transition-all">
                    {/* Collapsible Header Trigger */}
                    <div
                      onClick={() => setIsAggregatorExpanded(!isAggregatorExpanded)}
                      className="p-3 sm:p-3.5 flex items-center justify-between gap-2.5 cursor-pointer hover:bg-slate-100/70 transition-colors select-none"
                      role="button"
                      tabIndex={0}
                      aria-expanded={isAggregatorExpanded}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setIsAggregatorExpanded(!isAggregatorExpanded);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Calculator className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-xs font-bold text-slate-900 tracking-tight truncate">
                          Billing Calculator by Date
                        </span>
                        {isRangeActive && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 shrink-0 truncate max-w-[200px] sm:max-w-none">
                            {formatDateMMDDYYYY(startDate) || 'Start'} – {formatDateMMDDYYYY(endDate) || 'Present'} • {rangeTotalHours.toFixed(1)}h
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isRangeActive && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClearRange();
                            }}
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200/60 cursor-pointer transition-colors"
                            title="Clear date filter"
                          >
                            Clear
                          </button>
                        )}
                        <div className="text-slate-400 hover:text-slate-600 transition-colors">
                          {isAggregatorExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Content Body */}
                    {isAggregatorExpanded && (
                      <div className="px-3.5 pb-3.5 sm:px-4 sm:pb-4 pt-1 space-y-3 border-t border-slate-200/70 animate-fadeIn">
                        {/* Action Header: Expandable Filters, Copy, and Export side by side on the same line */}
                        <div className="flex items-center justify-between gap-1.5 sm:gap-2 pt-1">
                          {/* Expandable "Filters" Toggle */}
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                              className={`px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer shadow-2xs ${
                                isFiltersExpanded || (rangePreset !== 'all' && rangePreset !== 'custom')
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                              aria-expanded={isFiltersExpanded}
                            >
                              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>Filters</span>
                              {rangePreset !== 'all' && rangePreset !== 'custom' && (
                                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-emerald-500 text-white hidden sm:inline-block">
                                  {rangePreset === 'this-month' ? 'This Month' : rangePreset === 'last-month' ? 'Last Month' : rangePreset === 'this-quarter' ? 'This Qtr' : 'Last 30d'}
                                </span>
                              )}
                              {isFiltersExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 opacity-70 shrink-0" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 opacity-70 shrink-0" />
                              )}
                            </button>
                          </div>

                          {/* Export & Copy Actions */}
                          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={handleCopyInvoiceSummary}
                              className="px-2 sm:px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 active:scale-95 text-slate-700 font-bold text-xs flex items-center gap-1 sm:gap-1.5 shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                              title="Copy formatted invoice & session breakdown to clipboard"
                            >
                              {copiedInvoice ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span className="text-emerald-700 text-[11px] sm:text-xs">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                  <span className="text-[11px] sm:text-xs">
                                    <span className="sm:hidden">Copy</span>
                                    <span className="hidden sm:inline">Copy Summary</span>
                                  </span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={handleExportRangeCSV}
                              className="px-2 sm:px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 active:scale-95 text-slate-700 font-bold text-xs flex items-center gap-1 sm:gap-1.5 shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                              title="Export itemized CSV for this billing range"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span className="text-[11px] sm:text-xs">Export CSV</span>
                            </button>
                          </div>
                        </div>

                        {/* Expandable "Filters" Preset Panel */}
                        {isFiltersExpanded && (
                          <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-wrap items-center gap-1.5 animate-fadeIn">
                            {[
                              { key: 'all', label: 'All Time' },
                              { key: 'this-month', label: 'This Month' },
                              { key: 'last-month', label: 'Last Month' },
                              { key: 'this-quarter', label: 'This Quarter' },
                              { key: 'last-30', label: 'Last 30 Days' },
                            ].map((preset) => {
                              const isSelected = rangePreset === preset.key;
                              return (
                                <button
                                  key={preset.key}
                                  type="button"
                                  onClick={() => {
                                    applyPreset(preset.key as any);
                                    if (preset.key === 'all') {
                                      setIsFiltersExpanded(false);
                                    }
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-slate-900 text-white shadow-2xs font-bold'
                                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                                  }`}
                                >
                                  {preset.label}
                                </button>
                              );
                            })}

                            {isRangeActive && (
                              <button
                                type="button"
                                onClick={handleClearRange}
                                className="px-2 py-1 rounded-lg text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 flex items-center gap-1 transition-colors cursor-pointer ml-auto"
                                title="Reset to All Time"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Reset Filter</span>
                              </button>
                            )}
                          </div>
                        )}

                        {/* Custom Date Pickers */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              Start Date (From)
                            </label>
                            <input
                              type="date"
                              value={startDate}
                              onChange={(e) => {
                                setStartDate(e.target.value);
                                setRangePreset('custom');
                              }}
                              className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 shadow-2xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              End Date (To)
                            </label>
                            <input
                              type="date"
                              value={endDate}
                              onChange={(e) => {
                                setEndDate(e.target.value);
                                setRangePreset('custom');
                              }}
                              className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 shadow-2xs"
                            />
                          </div>
                        </div>

                        {isInvalidRange && (
                          <div className="text-[11px] text-rose-600 font-bold bg-rose-50 p-2 rounded-lg border border-rose-200">
                            Warning: Start date ({formatDateMMDDYYYY(startDate)}) is after End date ({formatDateMMDDYYYY(endDate)}). Please check the date range.
                          </div>
                        )}

                        {/* Range Calculation Breakdown Bar */}
                        <div className="p-3 rounded-lg bg-white border border-slate-200/90 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                          <div>
                            <div className="text-[10px] font-bold uppercase text-slate-400">Hours in Range</div>
                            <div className="text-base font-extrabold font-mono text-slate-900 mt-0.5">
                              {rangeTotalHours.toFixed(2)}h
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {formatSecondsToHHMMSS(rangeTotalSeconds)}
                            </div>
                          </div>

                          <div>
                            <div className="text-[10px] font-bold uppercase text-slate-400">Billable Amount</div>
                            <div className="text-base font-extrabold font-mono text-emerald-700 mt-0.5">
                              ${rangeBillableTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              {activeRate > 0 ? `@ $${activeRate.toFixed(2)}/hr` : 'No rate set'}
                            </div>
                          </div>

                          <div>
                            <div className="text-[10px] font-bold uppercase text-slate-400">Punches in Range</div>
                            <div className="text-base font-extrabold font-mono text-slate-900 mt-0.5">
                              {rangeSessionCount}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              across {rangeDistinctDaysCount} days
                            </div>
                          </div>

                          <div>
                            <div className="text-[10px] font-bold uppercase text-slate-400">Avg / Session</div>
                            <div className="text-base font-extrabold font-mono text-slate-900 mt-0.5">
                              {rangeSessionCount > 0 ? (rangeTotalHours / rangeSessionCount).toFixed(1) : 0}h
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              per punch
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Metrics Highlights */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
                        <span>{isRangeActive ? 'Period Project Time' : 'Total Project Time'}</span>
                        {isRangeActive && (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-xs">
                            Range
                          </span>
                        )}
                      </div>
                      <div className="text-lg font-extrabold font-mono text-indigo-950">
                        {formatSecondsToHHMMSS(rangeTotalSeconds)}
                      </div>
                      {isRangeActive && (
                        <div className="text-[10px] text-slate-400 font-medium">
                          All-time: {activeStats.totalHours}h
                        </div>
                      )}
                    </div>
                    {activeStats.project.billableRate && activeStats.project.billableRate > 0 ? (
                      <div className="text-[12px] font-bold font-mono text-emerald-700 mt-1 flex items-center gap-1.5">
                        <span>
                          ${rangeBillableTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          (${activeStats.project.billableRate.toFixed(2)}/hr)
                        </span>
                      </div>
                    ) : (
                      <div className="h-4 mt-1" />
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
                      <span>{isRangeActive ? 'Period Punches' : 'Punches Logged'}</span>
                      {isRangeActive && (
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-xs">
                          Range
                        </span>
                      )}
                    </div>
                    <div className="text-lg font-extrabold font-mono text-slate-900">
                      {rangeSessionCount}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Average ~{rangeSessionCount > 0 ? (rangeTotalSeconds / rangeSessionCount / 3600).toFixed(1) : 0}h / punch
                      {isRangeActive && (
                        <span className="block text-[10px] text-slate-400">
                          All-time: {activeStats.sessionCount} punches
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Session Notes & Accomplished Objectives Log */}
                <div className="space-y-2 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" style={{ color: secondaryColor }} />
                      Session Notes & Accomplished Objectives
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      {isRangeActive ? (
                        <span>Showing {filteredRangeLogs.length} of {activeStats.logs.length} entries</span>
                      ) : (
                        <span>{activeStats.logs.length} entries</span>
                      )}
                    </span>
                  </div>

                  {isRangeActive && (
                    <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-emerald-50/80 border border-emerald-200/80 text-[11px] text-emerald-900 font-medium">
                      <span>
                        Showing sessions from <strong>{formatDateMMDDYYYY(startDate) || 'Start'}</strong> to <strong>{formatDateMMDDYYYY(endDate) || 'Present'}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={handleClearRange}
                        className="text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer text-[10px]"
                      >
                        Clear Range
                      </button>
                    </div>
                  )}

                  <div className="space-y-2.5">
                    {filteredRangeLogs.length === 0 ? (
                      <EmptyState
                        icon={FileText}
                        title={isRangeActive ? "No Sessions in Date Range" : "No Sessions Logged Yet"}
                        description={
                          isRangeActive
                            ? `No punches were recorded for this project between ${formatDateMMDDYYYY(startDate) || 'Start'} and ${formatDateMMDDYYYY(endDate) || 'End'}. Try expanding the date range.`
                            : "No punches or notes have been logged for this project yet. Assign this project when clocking in."
                        }
                        compact
                        action={isRangeActive ? { label: 'Reset to All Time', onClick: handleClearRange } : undefined}
                      />
                    ) : (
                      filteredRangeLogs.map((log) => {
                        const isEditingThisPunch = editingLogId === log.id;

                        if (isEditingThisPunch) {
                          return (
                            <div
                              key={log.id}
                              className="p-3.5 rounded-xl bg-white border-2 border-indigo-300 shadow-sm text-xs space-y-3"
                            >
                              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                                <span className="font-bold text-indigo-900 text-xs flex items-center gap-1.5">
                                  <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                                  Edit Punch Session
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleSavePunchEdit(log)}
                                    className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                    title="Save changes"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Save</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelEditPunch}
                                    className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                                    title="Cancel"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div>
                                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                                    Date
                                  </label>
                                  <input
                                    type="date"
                                    value={editLogDate}
                                    onChange={(e) => setEditLogDate(e.target.value)}
                                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md font-mono"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                                    Clock In Time
                                  </label>
                                  <input
                                    type="time"
                                    step="1"
                                    value={editLogInTime}
                                    onChange={(e) => setEditLogInTime(e.target.value)}
                                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md font-mono text-emerald-800 font-semibold"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                                    Clock Out Time
                                  </label>
                                  <input
                                    type="time"
                                    step="1"
                                    value={editLogOutTime}
                                    onChange={(e) => setEditLogOutTime(e.target.value)}
                                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md font-mono text-rose-800 font-semibold"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                                  Assigned Project
                                </label>
                                <select
                                  value={editLogProjectId}
                                  onChange={(e) => setEditLogProjectId(e.target.value)}
                                  className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md bg-white font-medium text-slate-800 cursor-pointer"
                                >
                                  {projects.filter((p) => !p.isDeleted).map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} {p.client ? `(${p.client})` : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                                  Notes & Accomplished Objectives
                                </label>
                                <textarea
                                  rows={2}
                                  value={editLogNote}
                                  onChange={(e) => setEditLogNote(e.target.value)}
                                  placeholder="Add notes, tasks accomplished, or deliverables..."
                                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
                                />
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={log.id}
                            className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90 text-xs space-y-1.5 hover:bg-slate-50 transition-colors shadow-2xs group"
                          >
                            <div className="flex items-center justify-between gap-2">
                              {/* Left: Date */}
                              <div className="font-bold text-slate-900 font-mono flex items-center gap-1.5 text-xs">
                                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                <span>{formatDateMMDDYYYY(log.date)}</span>
                              </div>

                              {/* Right: Edit & Remove Action Buttons */}
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditPunch(log)}
                                  className="p-1 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                  title="Edit this punch session"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePunch(log)}
                                  className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Delete this punch session"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Line 2: Start - Stop Times (Duration) */}
                            <div className="text-[11.5px] font-mono text-slate-700 font-medium flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>
                                {log.inTime && log.outTime
                                  ? `${formatTime24to12(log.inTime)} – ${formatTime24to12(log.outTime)} (${formatSecondsToHuman(log.durationSec)})`
                                  : log.inTime
                                  ? `${formatTime24to12(log.inTime)} – In Progress (Active)`
                                  : 'Open Shift'}
                              </span>
                            </div>

                            {/* Line 3: Notes / Annotation (only if they exist) */}
                            {log.note && log.note.trim().length > 0 && (
                              <div className="pt-1 mt-1 border-t border-slate-200/70 text-slate-700 text-xs flex items-baseline gap-1.5 leading-relaxed">
                                <span className="font-bold shrink-0 select-none" style={{ color: themeColor }}>•</span>
                                <span className="break-words font-normal">{log.note.trim()}</span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        )}

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="hidden sm:inline">Assign projects when clocking in or editing any past date timesheet.</span>
          <span className="sm:hidden">Assign projects on clock in.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-2xs transition-all cursor-pointer hover:opacity-90 active:scale-98 ml-auto"
            style={{ backgroundColor: themeColor }}
          >
            Done
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmModal
        options={confirmDialog}
        onClose={() => setConfirmDialog(null)}
        themeColor={themeColor}
      />
    </div>
  );
}
