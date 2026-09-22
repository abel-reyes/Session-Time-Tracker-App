import { 
  Calendar, 
  Download, 
  ChevronRight, 
  Edit3, 
  ArrowUpRight,
  FolderKanban,
  FileText
} from 'lucide-react';
import { RecentEntry, Project } from '../types';
import { formatTime24to12, formatDateMMDDYYYY } from '../utils/timeCalculations';
import { ProjectBadge } from './ProjectBadge';
import { EmptyState } from './EmptyState';

interface RecentTableProps {
  recentEntries: RecentEntry[];
  onOpenTimesheetModal: () => void;
  onExportCSV: () => void;
  onEditDay: (dateStr: string) => void;
  activeQuarter: string;
  projects?: Project[];
  themeColor?: string;
  secondaryColor?: string;
}

export function RecentTable({
  recentEntries,
  onOpenTimesheetModal,
  onExportCSV,
  onEditDay,
  activeQuarter,
  projects = [],
  themeColor = '#0284C7',
  secondaryColor = '#0F172A',
}: RecentTableProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 md:p-6 shadow-2xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar className="w-4 h-4" style={{ color: themeColor }} />
            Recent Session Entries
          </h2>
          <p className="text-xs text-slate-500">
            Latest daily timestamps and work durations in {activeQuarter}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-export-csv"
            onClick={onExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            style={{ backgroundColor: secondaryColor, color: '#ffffff' }}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            id="btn-view-all-timesheet"
            onClick={onOpenTimesheetModal}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 transition-colors cursor-pointer"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200/70 text-slate-500 bg-slate-50/50">
              <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Date & Day</th>
              <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Projects / Notes</th>
              <th className="py-2.5 px-3 font-bold uppercase tracking-wider">First In</th>
              <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Last Out</th>
              <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-right">Day Total</th>
              <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {recentEntries.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 px-3">
                  <EmptyState
                    icon={Calendar}
                    title="No Session Entries Found"
                    description={`No clock entries recorded for ${activeQuarter} yet. Clock in to begin logging time.`}
                    compact
                  />
                </td>
              </tr>
            ) : (
              recentEntries.map((entry) => {
                return (
                  <tr
                    key={entry.date}
                    className="hover:bg-slate-50/70 transition-colors group"
                  >
                    <td className="py-3 px-3 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        {/* Uniform neutral day badge - weekends not colored differently */}
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {entry.dayOfWeek}
                        </span>
                        <span className="font-mono text-xs font-semibold">{formatDateMMDDYYYY(entry.date)}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3 max-w-[200px]">
                      <div className="space-y-1">
                        {entry.projectNames && entry.projectNames.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {entry.projectNames.map((pName, pIdx) => {
                              const matchedProj = projects.find(p => p.name === pName);
                              const projColor = matchedProj?.color || '#4f46e5';
                              return (
                                <ProjectBadge
                                  key={pIdx}
                                  name={pName}
                                  color={projColor}
                                  size="sm"
                                />
                              );
                            })}
                          </div>
                        ) : null}
                        {entry.notes ? (
                          <p className="text-[11px] text-slate-500 truncate" title={entry.notes}>
                            {entry.notes}
                          </p>
                        ) : !entry.projectNames?.length ? (
                          <span className="text-[11px] text-slate-400 italic">—</span>
                        ) : null}
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-emerald-800 font-medium">
                      {formatTime24to12(entry.lastIn)}
                    </td>

                    <td className="py-3 px-3 font-mono text-rose-800 font-medium">
                      {formatTime24to12(entry.lastOut)}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 text-sm">
                      {entry.totalFormatted}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => onEditDay(entry.date)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                        title="Edit punches for this date"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
        <span>Showing recent entries with active project annotations.</span>
        <button
          onClick={onOpenTimesheetModal}
          className="hover:underline font-semibold flex items-center gap-1 cursor-pointer"
          style={{ color: themeColor }}
        >
          <span>Open Full Quarterly Spreadsheet View</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
