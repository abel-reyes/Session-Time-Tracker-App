import { useState, useRef, ChangeEvent, Fragment } from 'react';
import { 
  FileSpreadsheet, 
  X, 
  Download, 
  Upload, 
  Plus, 
  Trash2, 
  Edit2, 
  Search, 
  Check, 
  Calendar,
  FolderKanban,
  FileText,
  ChevronDown
} from 'lucide-react';
import { DayRecord, PunchPair, Project } from '../types';
import { 
  createEmptyPunches, 
  calculateDayTotalSeconds, 
  formatSecondsToHHMMSS, 
  formatDateToYYYYMMDD, 
  formatDateMMDDYYYY,
  parseCSVToRecordsAndProjects
} from '../utils/timeCalculations';
import { ConfirmModal, ConfirmDialogOptions } from './ConfirmModal';
import { EmptyState } from './EmptyState';

interface TimesheetDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  quarterName: string;
  records: DayRecord[];
  projects?: Project[];
  onSaveRecords: (updated: DayRecord[]) => void;
  onSaveProjects?: (updated: Project[]) => void;
  onExportCSV: () => void;
  onOpenDateEditor?: (dateStr: string) => void;
  themeColor?: string;
}

export function TimesheetDetailModal({
  isOpen,
  onClose,
  quarterName,
  records,
  projects = [],
  onSaveRecords,
  onSaveProjects,
  onExportCSV,
  onOpenDateEditor,
  themeColor = '#0284C7',
}: TimesheetDetailModalProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DayRecord | null>(null);
  const [showAddRow, setShowAddRow] = useState<boolean>(false);
  const [newRowDate, setNewRowDate] = useState<string>(formatDateToYYYYMMDD(new Date()));
  const [isCsvMenuOpen, setIsCsvMenuOpen] = useState<boolean>(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogOptions | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  if (!isOpen) return null;

  const sortedRecords = [...records].sort((a, b) => a.date.localeCompare(b.date));

  const filteredRecords = sortedRecords.filter((r) =>
    r.date.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.notes && r.notes.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Calculate total seconds across all filtered records
  const totalQuarterSeconds = filteredRecords.reduce((sum, r) => {
    return sum + calculateDayTotalSeconds(r.punches || []);
  }, 0);

  // Compute maximum populated session slots present across all records
  let maxPopulatedSlots = 0;
  records.forEach((r) => {
    if (r.punches && Array.isArray(r.punches)) {
      r.punches.forEach((p, idx) => {
        if ((p.inTime && p.inTime.trim() !== '') || (p.outTime && p.outTime.trim() !== '')) {
          maxPopulatedSlots = Math.max(maxPopulatedSlots, idx + 1);
        }
      });
    }
  });

  if (editForm?.punches && Array.isArray(editForm.punches)) {
    editForm.punches.forEach((p, idx) => {
      if ((p.inTime && p.inTime.trim() !== '') || (p.outTime && p.outTime.trim() !== '')) {
        maxPopulatedSlots = Math.max(maxPopulatedSlots, idx + 1);
      }
    });
    // While actively editing, make sure the user can see all active slots they are filling
    maxPopulatedSlots = Math.max(maxPopulatedSlots, editForm.punches.length);
  }

  // Minimum 1 session column so the table is always structured and valid
  const maxSlots = Math.max(maxPopulatedSlots, 1);

  const handleStartEdit = (record: DayRecord) => {
    setEditingDate(record.date);
    const punchesCopy: PunchPair[] = (record.punches || []).map((p) => ({ ...p }));
    while (punchesCopy.length < maxSlots) {
      punchesCopy.push({ inTime: '', outTime: '', note: '' });
    }
    setEditForm({
      ...record,
      punches: punchesCopy,
    });
  };

  const handleRemovePunchSlot = (slotIdx: number) => {
    if (!editForm) return;
    const punchesCopy = [...(editForm.punches || [])];
    punchesCopy.splice(slotIdx, 1);
    setEditForm({
      ...editForm,
      punches: punchesCopy.length > 0 ? punchesCopy : [{ inTime: '', outTime: '', note: '' }],
    });
  };

  const handleSaveEdit = () => {
    if (!editForm) return;
    // Clean up empty punches so ghost blank pairs are removed
    const cleanPunches = (editForm.punches || []).filter(
      (p) => Boolean(p.inTime && p.inTime.trim() !== '') || Boolean(p.outTime && p.outTime.trim() !== '')
    );
    const updatedRecord: DayRecord = {
      ...editForm,
      punches: cleanPunches,
      notes: editForm.notes?.trim() || undefined,
    };
    const updated = records.map((r) => (r.date === editForm.date ? updatedRecord : r));
    onSaveRecords(updated);
    setEditingDate(null);
    setEditForm(null);
  };

  const handleDeleteRecord = (dateStr: string) => {
    setConfirmDialog({
      title: `Delete Date Record?`,
      message: `Are you sure you want to delete all recorded sessions and logs for ${formatDateMMDDYYYY(dateStr)}?`,
      confirmText: 'Delete Record',
      variant: 'danger',
      onConfirm: () => {
        const updated = records.filter((r) => r.date !== dateStr);
        onSaveRecords(updated);
      },
    });
  };

  const handleAddManualRow = () => {
    if (!newRowDate) return;
    if (records.some((r) => r.date === newRowDate)) {
      alert(`An entry for date ${formatDateMMDDYYYY(newRowDate)} already exists.`);
      return;
    }
    const newRecord: DayRecord = {
      date: newRowDate,
      punches: createEmptyPunches(maxSlots),
    };
    const updated = [...records, newRecord];
    onSaveRecords(updated);
    setShowAddRow(false);
    handleStartEdit(newRecord);
  };

  const handleImportCSV = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const { records: parsedRecords, projects: parsedProjects } = parseCSVToRecordsAndProjects(text, projects);
        if (parsedRecords.length === 0 && parsedProjects.length === 0) {
          alert('Could not parse valid records or projects from CSV. Check format.');
          return;
        }

        // Merge Day Records
        if (parsedRecords.length > 0) {
          const map = new Map<string, DayRecord>();
          records.forEach((r) => map.set(r.date, r));
          parsedRecords.forEach((r) => map.set(r.date, r));
          const merged = Array.from(map.values());
          onSaveRecords(merged);
        }

        // Merge Projects
        let importedProjectCount = 0;
        if (parsedProjects.length > 0 && onSaveProjects) {
          const existingMap = new Map<string, Project>();
          projects.forEach(p => existingMap.set(p.name.toLowerCase().trim(), p));

          const mergedProjects = [...projects];
          for (const newP of parsedProjects) {
            const key = newP.name.toLowerCase().trim();
            if (!existingMap.has(key)) {
              mergedProjects.push(newP);
              existingMap.set(key, newP);
              importedProjectCount++;
            }
          }
          if (importedProjectCount > 0) {
            onSaveProjects(mergedProjects);
          }
        }

        const projectMsg = importedProjectCount > 0 ? ` and ${importedProjectCount} new project definitions` : '';
        alert(`Successfully imported ${parsedRecords.length} date entries${projectMsg} from CSV!`);
      } catch (err) {
        alert('Error importing CSV: ' + String(err));
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsCsvMenuOpen(false);
  };

  const handleAddSlotToEditForm = () => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      punches: [...editForm.punches, { inTime: '', outTime: '', note: '' }],
    });
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal matching responsive container dimensions */}
      <div className="bg-white rounded-2xl max-w-lg sm:max-w-xl md:max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92dvh] sm:max-h-[88vh]">
        {/* Sticky Header with X in Top Right Corner */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div 
              className="w-8 h-8 rounded-xl text-white flex items-center justify-center shadow-xs shrink-0"
              style={{ backgroundColor: themeColor }}
            >
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">
                  {quarterName} <span className="hidden sm:inline">Timesheet</span>
                </h3>
                <span className="text-xs text-slate-500 font-medium shrink-0">
                  ({filteredRecords.length} records)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setShowAddRow(!showAddRow)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white shadow-2xs transition-colors cursor-pointer"
              style={{ backgroundColor: themeColor }}
              title="Add a new date row"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add Date</span>
            </button>

            {/* Combined CSV Button with Dropdown */}
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
                <div className="absolute right-0 mt-1.5 w-40 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-fadeIn">
                  <button
                    type="button"
                    onClick={() => {
                      onExportCSV();
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
                      onChange={handleImportCSV}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* X to Exit in Top Right Corner */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer ml-0.5"
              title="Close timesheet window"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar & Search */}
        <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search date or note..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-200 bg-white focus:outline-emerald-600 shadow-2xs"
            />
          </div>
          <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
            {maxSlots} {maxSlots === 1 ? 'session' : 'sessions'}
          </span>
        </div>

        {/* Add Row Prompt Bar */}
        {showAddRow && (
          <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-200 flex flex-wrap items-center justify-between gap-2 shrink-0 animate-fadeIn">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-bold text-emerald-950">Add date:</span>
              <input
                type="date"
                value={newRowDate}
                onChange={(e) => setNewRowDate(e.target.value)}
                className="bg-white border border-emerald-300 rounded-lg px-2 py-1 text-xs text-slate-900"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleAddManualRow}
                className="px-2.5 py-1 rounded-md text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 cursor-pointer"
              >
                Add
              </button>
              <button
                onClick={() => setShowAddRow(false)}
                className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Full Grid Table Container with smooth horizontal swipe/scroll */}
        <div
          ref={tableContainerRef}
          className="flex-1 overflow-x-auto overflow-y-auto overscroll-x-contain touch-pan-x touch-pan-y p-3 sm:p-4"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs min-w-max">
            <table className="text-left text-xs border-collapse font-sans min-w-full">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold sticky top-0 z-20 shadow-xs">
                <tr>
                  {/* Sticky Date Column */}
                  <th className="py-2 px-3 border-r border-slate-200 whitespace-nowrap sticky left-0 bg-slate-100 z-30 shadow-xs">
                    Date
                  </th>

                  {/* Dynamic Session Headers */}
                  {Array.from({ length: maxSlots }, (_, i) => i + 1).map((slot) => (
                    <th
                      key={slot}
                      colSpan={2}
                      className="py-1.5 px-2 border-r border-slate-200 text-center uppercase tracking-wider text-[10px] bg-slate-100 font-bold text-slate-800"
                    >
                      Session #{slot}
                    </th>
                  ))}

                  <th className="py-2 px-3 border-r border-slate-200 whitespace-nowrap">
                    Notes
                  </th>

                  <th className="py-2 px-3 border-r border-slate-200 text-right whitespace-nowrap">
                    Total Hours
                  </th>
                  <th className="py-2 px-3 text-center whitespace-nowrap sticky right-0 bg-slate-100 z-30 shadow-xs">
                    Actions
                  </th>
                </tr>

                <tr className="bg-slate-50 text-[10px] text-slate-500 border-b border-slate-200">
                  <th className="py-1 px-3 border-r border-slate-200 sticky left-0 bg-slate-50 z-30 font-normal">
                    MM/DD/YYYY
                  </th>
                  {Array.from({ length: maxSlots }, (_, i) => i).map((slotIdx) => (
                    <Fragment key={slotIdx}>
                      <th className="py-0.5 px-2 border-r border-slate-200 text-center font-mono font-normal">In</th>
                      <th className="py-0.5 px-2 border-r border-slate-200 text-center font-mono font-normal">Out</th>
                    </Fragment>
                  ))}
                  <th className="py-1 px-3 border-r border-slate-200 text-left font-sans font-normal">Summary</th>
                  <th className="py-1 px-3 border-r border-slate-200 text-right font-mono font-normal">HH:MM:SS</th>
                  <th className="py-1 px-3 text-center sticky right-0 bg-slate-50 z-30 font-normal">Edit / Del</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4 + maxSlots * 2}
                      className="py-10 text-center text-slate-400 italic"
                    >
                      No records match the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((rec) => {
                    const isEditing = editingDate === rec.date;
                    const punches = isEditing && editForm ? editForm.punches : (rec.punches || []);
                    const daySec = calculateDayTotalSeconds(punches);

                    return (
                      <tr
                        key={rec.date}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isEditing ? 'bg-emerald-50/50 ring-1 ring-emerald-400' : ''
                        }`}
                      >
                        {/* Sticky Date */}
                        <td className={`py-2 px-3 font-mono font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap sticky left-0 z-10 ${
                          isEditing ? 'bg-emerald-50' : 'bg-white'
                        }`}>
                          <button
                            type="button"
                            onClick={() => onOpenDateEditor?.(rec.date)}
                            className="hover:text-emerald-700 hover:underline text-left cursor-pointer flex items-center gap-1.5"
                            title="Open session editor for this date"
                          >
                            <span>{formatDateMMDDYYYY(rec.date)}</span>
                          </button>
                        </td>

                        {/* All Punch Pairs */}
                        {Array.from({ length: maxSlots }, (_, slotIdx) => {
                          const pair = punches[slotIdx];

                          return (
                            <Fragment key={slotIdx}>
                              {/* In Time */}
                              <td className="py-1 px-1.5 border-r border-slate-100 text-center font-mono">
                                {isEditing && editForm ? (
                                  <input
                                    type="text"
                                    placeholder="HH:mm:ss"
                                    value={editForm.punches[slotIdx]?.inTime || ''}
                                    onChange={(e) => {
                                      const copy = { ...editForm };
                                      if (!copy.punches[slotIdx]) copy.punches[slotIdx] = { inTime: '', outTime: '', note: '' };
                                      copy.punches[slotIdx].inTime = e.target.value;
                                      setEditForm(copy);
                                    }}
                                    className="w-18 px-1 py-0.5 text-center text-xs border border-emerald-300 rounded-md bg-white focus:outline-emerald-600 font-mono"
                                  />
                                ) : (
                                  <span className={pair?.inTime ? 'text-emerald-800 font-medium inline-flex items-center gap-1 justify-center' : 'text-slate-300'}>
                                    {pair?.isMultiDaySegment && (
                                      <span title={`Cross-day segment ${pair.segmentIndex !== undefined ? pair.segmentIndex + 1 : ''}/${pair.totalSegments || ''}`} className="text-[10px]">
                                        🌙
                                      </span>
                                    )}
                                    {pair?.inTime || '—'}
                                  </span>
                                )}
                              </td>

                              {/* Out Time */}
                              <td className="py-1 px-1.5 border-r border-slate-200 text-center font-mono">
                                {isEditing && editForm ? (
                                  <div className="flex items-center gap-1 justify-center">
                                    <input
                                      type="text"
                                      placeholder="HH:mm:ss"
                                      value={editForm.punches[slotIdx]?.outTime || ''}
                                      onChange={(e) => {
                                        const copy = { ...editForm };
                                        if (!copy.punches[slotIdx]) copy.punches[slotIdx] = { inTime: '', outTime: '', note: '' };
                                        copy.punches[slotIdx].outTime = e.target.value;
                                        setEditForm(copy);
                                      }}
                                      className="w-16 px-1 py-0.5 text-center text-xs border border-emerald-300 rounded-md bg-white focus:outline-emerald-600 font-mono"
                                    />
                                    {editForm.punches.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemovePunchSlot(slotIdx)}
                                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                        title={`Remove session #${slotIdx + 1}`}
                                      >
                                        <Trash2 className="w-3 h-3 text-rose-500" />
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className={pair?.outTime ? 'text-rose-800 font-medium' : 'text-slate-300'}>
                                    {pair?.outTime || '—'}
                                  </span>
                                )}
                              </td>
                            </Fragment>
                          );
                        })}

                        {/* Day Notes & Objectives */}
                        <td className="py-1.5 px-3 border-r border-slate-200 text-slate-600 max-w-[180px] truncate">
                          {isEditing && editForm ? (
                            <input
                              type="text"
                              placeholder="Add day notes..."
                              value={editForm.notes || ''}
                              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                              className="w-full px-2 py-1 text-xs border border-emerald-300 rounded-md bg-white focus:outline-emerald-600"
                            />
                          ) : rec.notes ? (
                            <span className="flex items-center gap-1 text-xs text-slate-700 truncate" title={rec.notes}>
                              <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{rec.notes}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300 italic text-[11px]">—</span>
                          )}
                        </td>

                        {/* Total Hours */}
                        <td className="py-1.5 px-3 border-r border-slate-200 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatSecondsToHHMMSS(daySec)}
                        </td>

                        {/* Sticky Actions Column */}
                        <td className={`py-1.5 px-3 text-center whitespace-nowrap sticky right-0 z-10 shadow-xs ${
                          isEditing ? 'bg-emerald-50' : 'bg-white'
                        }`}>
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={handleSaveEdit}
                                className="p-1 rounded-md text-emerald-700 bg-emerald-100 hover:bg-emerald-200 cursor-pointer"
                                title="Save changes"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={handleAddSlotToEditForm}
                                className="p-1 rounded-md text-teal-700 bg-teal-100 hover:bg-teal-200 cursor-pointer"
                                title="Add another slot"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingDate(null);
                                  setEditForm(null);
                                }}
                                className="p-1 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => onOpenDateEditor?.(rec.date)}
                                className="p-1 rounded-md text-teal-600 hover:text-teal-800 hover:bg-teal-50 cursor-pointer"
                                title="Session editor for this day"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleStartEdit(rec)}
                                className="p-1 rounded-md text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                                title="Inline edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRecord(rec.date)}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                title="Delete row"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Sticky Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Total Logged:</span>
            <strong className="font-mono font-bold text-slate-900">
              {formatSecondsToHHMMSS(totalQuarterSeconds)}
            </strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-2xs transition-all cursor-pointer hover:opacity-90 active:scale-98"
            style={{ backgroundColor: themeColor }}
          >
            Close
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

