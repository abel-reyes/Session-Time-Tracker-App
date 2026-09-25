import { useState, useMemo } from 'react';
import { 
  Clock, 
  CalendarDays, 
  Flame, 
  Target,
  BarChart2,
  TrendingUp,
  DollarSign,
  ChevronDown
} from 'lucide-react';
import { DashboardMetrics, AppSettings, DayRecord, Project } from '../types';
import { 
  formatSecondsToHHMMSS, 
  formatSecondsToHuman, 
  getTodayMondayDate, 
  formatWeekRangeShort,
  formatDateToYYYYMMDD,
  getQuarterWeeksBreakdown,
  getQuarterName,
  calculateDateRangeBillable
} from '../utils/timeCalculations';
import { QuarterWeeksModal } from './QuarterWeeksModal';

interface MetricsOverviewProps {
  metrics: DashboardMetrics;
  settings: AppSettings;
  liveExtraSeconds: number;
  records?: DayRecord[];
  projects?: Project[];
  activeQuarter?: string;
  themeColor?: string;
  secondaryColor?: string;
  onOpenQuarterWeeksModal?: () => void;
}

export function MetricsOverview({ 
  metrics, 
  settings, 
  liveExtraSeconds,
  records = [],
  projects = [],
  activeQuarter = getQuarterName(),
  themeColor = '#0284C7',
  secondaryColor = settings.chartColor || '#0F172A',
  onOpenQuarterWeeksModal,
}: MetricsOverviewProps) {
  const [avgPeriod, setAvgPeriod] = useState<'month' | 'quarter'>('month');
  const [isQuarterWeeksModalOpen, setIsQuarterWeeksModalOpen] = useState(false);
  const [isBillableExpanded, setIsBillableExpanded] = useState(false);

  const currentTodaySeconds = metrics.todaySeconds + liveExtraSeconds;
  const currentWeekSeconds = metrics.weekSeconds + liveExtraSeconds;
  const currentMonthSeconds = metrics.monthSeconds + liveExtraSeconds;
  const currentQuarterSeconds = metrics.quarterSeconds + liveExtraSeconds;

  const currentMonday = useMemo(() => getTodayMondayDate(), []);
  const currentWeekRangeStr = useMemo(() => formatWeekRangeShort(currentMonday), [currentMonday]);
  const currentMondayStr = useMemo(() => formatDateToYYYYMMDD(currentMonday), [currentMonday]);
  const currentSundayStr = useMemo(() => {
    const sun = new Date(currentMonday);
    sun.setDate(currentMonday.getDate() + 6);
    return formatDateToYYYYMMDD(sun);
  }, [currentMonday]);

  // Project-isolated weekly billable total
  const weeklyBillable = useMemo(() => {
    return calculateDateRangeBillable(
      records,
      projects,
      currentMondayStr,
      currentSundayStr,
      liveExtraSeconds
    );
  }, [records, projects, currentMondayStr, currentSundayStr, liveExtraSeconds]);

  // Compute breakdown of all weeks of the quarter for the modal
  const quarterWeeks = useMemo(() => {
    return getQuarterWeeksBreakdown(records, activeQuarter, liveExtraSeconds);
  }, [records, activeQuarter, liveExtraSeconds]);

  const weeklyGoalHours = settings.weeklyGoalHours || 0;
  const weeklyGoalSeconds = weeklyGoalHours * 3600;
  const goalsEnabled = settings.enableGoals === true && weeklyGoalHours > 0;

  // Goal calculates above 100% without capping
  const weekProgressPercent = goalsEnabled
    ? Math.round((currentWeekSeconds / (weeklyGoalSeconds || 1)) * 100)
    : 0;
  const isGoalExceeded = weekProgressPercent > 100;
  const isGoalMet = weekProgressPercent >= 100;

  const streaksEnabled = settings.enableStreaks === true;

  // Weekly Average Calculations
  const weeksInMonth = metrics.weeksInMonthElapsed || Math.max(0.5, new Date().getDate() / 7);
  const weeksInQuarter = metrics.weeksInQuarterElapsed || 13;

  const liveWeeklyAvgMonth = Number(((currentMonthSeconds / 3600) / weeksInMonth).toFixed(1));
  const liveWeeklyAvgQuarter = Number(((currentQuarterSeconds / 3600) / weeksInQuarter).toFixed(1));

  const activeWeeklyAvgHours = avgPeriod === 'month' ? liveWeeklyAvgMonth : liveWeeklyAvgQuarter;
  const activeAvgLabel = avgPeriod === 'month' ? 'Per Month' : 'Per Quarter';

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5">
        {/* 1. Today */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Today
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 tracking-tight">
              {formatSecondsToHHMMSS(currentTodaySeconds)}
            </div>
          </div>
          <div className="mt-3.5 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2.5">
            <span>{formatSecondsToHuman(currentTodaySeconds)} logged</span>
            {liveExtraSeconds > 0 ? (
              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                Live clocking
              </span>
            ) : (
              <span className="text-slate-400">Session closed</span>
            )}
          </div>
        </div>

        {/* 2. This Week & Goals */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <div className="flex items-baseline gap-1.5 overflow-hidden">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 shrink-0">
                  This Week:
                </span>
                <span className="text-xs font-bold text-slate-800 tracking-tight truncate" title={currentWeekRangeStr}>
                  {currentWeekRangeStr}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onOpenQuarterWeeksModal) {
                    onOpenQuarterWeeksModal();
                  } else {
                    setIsQuarterWeeksModalOpen(true);
                  }
                }}
                className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-600 flex items-center justify-center transition-all cursor-pointer ring-1 ring-blue-100 hover:ring-blue-300"
                title="Click to view & compare all weeks of the quarter"
                aria-label="View all weeks of the quarter"
              >
                <CalendarDays className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 tracking-tight">
                {formatSecondsToHHMMSS(currentWeekSeconds)}
              </div>
              {goalsEnabled && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md font-mono ${
                  isGoalExceeded
                    ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300'
                    : isGoalMet
                    ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300'
                    : 'bg-blue-50 text-blue-700'
                }`}>
                  {weekProgressPercent}%
                </span>
              )}
            </div>
          </div>

          {/* Goal Progress bar (supporting > 100%) or summary */}
          {goalsEnabled ? (
            <div className="mt-3.5 space-y-1.5 border-t border-slate-100 pt-2.5">
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                <span className="flex items-center gap-1">
                  <Target className="w-3.5 h-3.5 shrink-0" style={{ color: secondaryColor }} />
                  Target: {weeklyGoalHours}h
                </span>
                <span className="text-xs font-semibold text-slate-700">
                  {isGoalExceeded ? (
                    <span className="text-amber-700 font-semibold">
                      +{(weekProgressPercent - 100)}% over goal
                    </span>
                  ) : (
                    `${(currentWeekSeconds / 3600).toFixed(1)} / ${weeklyGoalHours}h`
                  )}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isGoalExceeded
                      ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-amber-500'
                      : 'bg-gradient-to-r from-blue-500 to-teal-500'
                  }`}
                  style={{ width: `${Math.min(100, weekProgressPercent)}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="mt-3.5 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2.5">
              <span>{formatSecondsToHuman(currentWeekSeconds)} total</span>
              <span className="text-slate-500 font-medium">{metrics.daysWorkedThisWeek} days active</span>
            </div>
          )}

          {/* Streaks (Shown ONLY if enabled by user in settings) */}
          {streaksEnabled && (
            <div className="mt-2 text-xs text-emerald-700 font-semibold flex items-center justify-between border-t border-slate-100 pt-1.5">
              <span className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 fill-emerald-500 text-emerald-500" />
                {metrics.currentStreak} Day Streak
              </span>
              <span className="text-[11px] text-slate-400">Continuous log</span>
            </div>
          )}

          {/* Project-Isolated Billable Total */}
          {weeklyBillable.hasBillableProjects && weeklyBillable.totalBillableAmount > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setIsBillableExpanded(!isBillableExpanded)}
                className="w-full flex items-center justify-between text-left cursor-pointer group hover:opacity-90 transition-opacity"
                title="Click to toggle project-by-project billable invoice breakdown"
              >
                <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                  <span className="uppercase tracking-wider text-[10px] text-slate-400">Billable:</span>
                  <span className="font-mono text-emerald-700 font-bold bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded shadow-2xs">
                    ${weeklyBillable.totalBillableAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isBillableExpanded ? 'rotate-180 text-emerald-600' : ''}`} />
                </span>
                <span className="text-[10px] text-slate-400 font-mono group-hover:text-slate-600">
                  {weeklyBillable.totalBillableHours}h ({weeklyBillable.items.length} {weeklyBillable.items.length === 1 ? 'client' : 'clients'})
                </span>
              </button>

              {/* Collapsible Freelancer Invoice Breakdown */}
              {isBillableExpanded && (
                <div className="mt-2 space-y-1.5 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/70 animate-fadeIn">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                    <span>Freelancer Client Rates</span>
                    <span>Subtotal</span>
                  </div>
                  {weeklyBillable.items.map((item) => (
                    <div key={item.projectId} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 min-w-0 mr-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="font-semibold text-slate-700 truncate" title={`${item.projectName}${item.client ? ` (${item.client})` : ''}`}>
                          {item.projectName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          (${item.billableRate}/h)
                        </span>
                      </div>
                      <div className="text-right font-mono shrink-0">
                        <span className="text-slate-500 mr-1.5">{item.totalHours}h</span>
                        <span className="font-bold text-emerald-700">${item.billableAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quarter Weeks Breakdown & Comparison Modal (fallback if not handled globally) */}
      {!onOpenQuarterWeeksModal && (
        <QuarterWeeksModal
          isOpen={isQuarterWeeksModalOpen}
          onClose={() => setIsQuarterWeeksModalOpen(false)}
          quarterName={activeQuarter}
          weeks={quarterWeeks}
          weeklyGoalHours={weeklyGoalHours}
          themeColor={themeColor}
          secondaryColor={secondaryColor}
          records={records}
          projects={projects}
          liveExtraSeconds={liveExtraSeconds}
        />
      )}
    </>
  );
}


