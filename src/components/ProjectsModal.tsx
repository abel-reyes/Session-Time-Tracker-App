import { useState, useRef, ChangeEvent, FormEvent } from 'react';
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
  ChevronDown
} from 'lucide-react';
import { Project, DayRecord } from '../types';
import { 
  formatSecondsToHuman, 
  formatSecondsToHHMMSS, 
  formatDateMMDDYYYY, 
  formatTime24to12,
  parseCSVToRecordsAndProjects
} from '../utils/timeCalculations';
import { ConfirmModal, ConfirmDialogOptions } from './ConfirmModal';
import { EmptyState } from './EmptyState';

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  records: DayRecord[];
  onSaveProjects: (projects: Project[]) => void;
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
  const [color, setColor] = useState<string>(PRESET_COLORS[0]);
  const [description, setDescription] = useState<string>('');
  const [isCsvMenuOpen, setIsCsvMenuOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Calculate project statistics from all records
  const projectStats = projects.map((p) => {
    let totalSec = 0;
    const sessionLogs: {
      date: string;
      inTime?: string;
      outTime?: string;
      durationSec: number;
      note?: string;
    }[] = [];

    records.forEach((r) => {
      (r.punches || []).forEach((punch) => {
        if (punch.projectId === p.id || punch.projectName === p.name) {
          let dur = 0;
          if (punch.inTime && punch.outTime) {
            const inParts = punch.inTime.split(':').map(Number);
            const outParts = punch.outTime.split(':').map(Number);
            const inSec = (inParts[0] || 0) * 3600 + (inParts[1] || 0) * 60 + (inParts[2] || 0);
            const outSec = (outParts[0] || 0) * 3600 + (outParts[1] || 0) * 60 + (outParts[2] || 0);
            dur = Math.max(0, outSec - inSec);
          }
          totalSec += dur;
          sessionLogs.push({
            date: r.date,
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
    setColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
    setDescription('');
    setIsCreating(true);
    setEditingProjectId(null);
  };

  const handleStartEdit = (p: Project) => {
    setName(p.name);
    setClient(p.client || '');
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

    if (isCreating) {
      const nowIso = new Date().toISOString();
      const newProj: Project = {
        id: `proj-${Date.now()}`,
        name: name.trim(),
        client: client.trim() || undefined,
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
      '# Project Name,Client,Color Hex,Description,Project ID',
    ];
    for (const p of activeProjects) {
      const nameSafe = (p.name || '').replace(/"/g, '""');
      const clientSafe = (p.client || '').replace(/"/g, '""');
      const colorSafe = (p.color || '#0284C7').replace(/"/g, '""');
      const descSafe = (p.description || '').replace(/"/g, '""');
      const idSafe = (p.id || '').replace(/"/g, '""');
      rows.push(`# "${nameSafe}","${clientSafe}","${colorSafe}","${descSafe}","${idSafe}"`);
    }
    rows.push('# END_PROJECTS_SECTION');
    rows.push('');
    rows.push('Project Name,Client,Color,Description,Total Hours,Total Sessions');
    for (const ps of projectStats) {
      if (ps.project.isDeleted) continue;
      const p = ps.project;
      const nameSafe = (p.name || '').replace(/"/g, '""');
      const clientSafe = (p.client || '').replace(/"/g, '""');
      const colorSafe = (p.color || '').replace(/"/g, '""');
      const descSafe = (p.description || '').replace(/"/g, '""');
      rows.push(`"${nameSafe}","${clientSafe}","${colorSafe}","${descSafe}",${ps.totalHours},${ps.sessionCount}`);
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

                {/* Metrics Highlights */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Total Project Time</div>
                    <div className="text-lg font-extrabold font-mono text-indigo-950">
                      {formatSecondsToHHMMSS(activeStats.totalSeconds)}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                      {formatSecondsToHuman(activeStats.totalSeconds)}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Punches Logged</div>
                    <div className="text-lg font-extrabold font-mono text-slate-900">
                      {activeStats.sessionCount}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Average ~{activeStats.sessionCount > 0 ? (activeStats.totalSeconds / activeStats.sessionCount / 3600).toFixed(1) : 0}h / punch
                    </div>
                  </div>
                </div>

                {/* Session Notes & Accomplished Objectives Log */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" style={{ color: secondaryColor }} />
                      Session Notes & Accomplished Objectives
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      {activeStats.logs.length} entries
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {activeStats.logs.length === 0 ? (
                      <EmptyState
                        icon={FileText}
                        title="No Sessions Logged Yet"
                        description="No punches or notes have been logged for this project yet. Assign this project when clocking in."
                        compact
                      />
                    ) : (
                      activeStats.logs.map((log, lIdx) => (
                        <div
                          key={lIdx}
                          className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/90 text-xs space-y-1 hover:bg-slate-50 transition-colors shadow-2xs"
                        >
                          {/* Line 1: Date */}
                          <div className="font-bold text-slate-900 font-mono flex items-center gap-1.5 text-xs">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            <span>{formatDateMMDDYYYY(log.date)}</span>
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
                      ))
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
