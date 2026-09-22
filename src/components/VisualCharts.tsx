import { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
} from 'recharts';
import { 
  LineChart as LineChartIcon, 
  BarChart3, 
  Clock, 
  PieChart as PieChartIcon, 
  Layers,
  FolderKanban
} from 'lucide-react';
import { WeeklyChartData, ChartViewType, DayRecord, Project, DashboardMetrics } from '../types';
import { formatDecimalHoursTo12H, formatSecondsToHuman } from '../utils/timeCalculations';

interface VisualChartsProps {
  chartData: WeeklyChartData;
  records: DayRecord[];
  metrics?: DashboardMetrics;
  projects?: Project[];
  dailyGoalHours: number;
  enableGoals?: boolean;
  chartColor?: string;
  themeColor?: string;
}

export function VisualCharts({ 
  chartData, 
  records, 
  metrics,
  projects = [],
  dailyGoalHours, 
  enableGoals = true,
  chartColor = '#0F172A',
  themeColor = '#0284C7'
}: VisualChartsProps) {
  const [activeChart, setActiveChart] = useState<ChartViewType>('bar');

  const primaryColor = themeColor || '#0284C7';
  const secondaryColor = chartColor || '#0F172A';

  // Prepare line/area comparison dataset (This Week vs Last Week)
  const comparisonData = chartData.dayLabels.map((label, idx) => ({
    day: label,
    date: chartData.dayDates[idx] || '',
    thisWeek: chartData.thisWeek[idx] || 0,
    lastWeek: chartData.lastWeek[idx] || 0,
  }));

  // Prepare Pie Chart data for Weekday vs Weekend (Comparison Donut)
  const ratioPieData = [
    {
      name: 'Weekdays',
      value: chartData.ratio.weekday,
      percent: chartData.ratio.weekdayPercent,
      color: primaryColor,
    },
    {
      name: 'Weekends',
      value: chartData.ratio.weekend,
      percent: chartData.ratio.weekendPercent,
      color: secondaryColor,
    },
  ].filter((d) => d.value > 0);

  // Timeline Gantt chart dataset
  const timelineDays = chartData.dayLabels.map((dayLabel, idx) => {
    const daySpans = chartData.spans[idx] || [];
    return {
      day: dayLabel,
      date: chartData.dayDates[idx] || '',
      spans: daySpans,
    };
  });

  // Calculate dynamic Y-axis headroom (limiting empty headroom to ~1 hour, maximum 2 hours)
  const maxComparisonVal = Math.max(
    ...chartData.thisWeek,
    ...chartData.lastWeek,
    0
  );
  const yMaxComparison = maxComparisonVal > 0
    ? Math.max(2, Math.ceil(maxComparisonVal + 0.9))
    : (enableGoals && dailyGoalHours > 0 ? Math.ceil(dailyGoalHours + 0.9) : 4);

  const maxDailyVal = Math.max(
    ...chartData.thisWeek,
    enableGoals && dailyGoalHours > 0 ? dailyGoalHours : 0,
    0
  );
  const yMaxDaily = maxDailyVal > 0
    ? Math.max(2, Math.ceil(maxDailyVal + 0.9))
    : (enableGoals && dailyGoalHours > 0 ? Math.ceil(dailyGoalHours + 0.9) : 4);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 md:p-6 shadow-xs">
      {/* Chart Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-4 h-4" style={{ color: primaryColor }} />
            Performance & Session Analytics
          </h2>
          <p className="text-xs text-slate-500">
            Interactive visual insights across daily sessions, timeline spans, and trends
          </p>
        </div>

        {/* View Switcher Chips */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/70">
          <button
            id="tab-chart-bar"
            onClick={() => setActiveChart('bar')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeChart === 'bar'
                ? 'bg-white shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            style={activeChart === 'bar' ? { color: primaryColor } : undefined}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Daily Bars</span>
          </button>

          <button
            id="tab-chart-line"
            onClick={() => setActiveChart('line')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeChart === 'line'
                ? 'bg-white shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            style={activeChart === 'line' ? { color: primaryColor } : undefined}
          >
            <LineChartIcon className="w-3.5 h-3.5" />
            <span>Comparison</span>
          </button>

          <button
            id="tab-chart-timeline"
            onClick={() => setActiveChart('timeline')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeChart === 'timeline'
                ? 'bg-white shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            style={activeChart === 'timeline' ? { color: primaryColor } : undefined}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Timeline</span>
          </button>

          <button
            id="tab-chart-doughnut"
            onClick={() => setActiveChart('doughnut')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeChart === 'doughnut'
                ? 'bg-white shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            style={activeChart === 'doughnut' ? { color: primaryColor } : undefined}
          >
            <PieChartIcon className="w-3.5 h-3.5" />
            <span>Ratio Donut</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="pt-6 min-h-[300px]">
        {/* 1. LINE / AREA COMPARISON CHART */}
        {activeChart === 'line' && (
          <div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={comparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorThisWeek" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={primaryColor} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={primaryColor} stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorLastWeek" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={secondaryColor} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={secondaryColor} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="day"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                    unit="h"
                    domain={[0, yMaxComparison]}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const thisVal = Number(payload[0]?.value || 0);
                      const lastVal = Number(payload[1]?.value || 0);
                      const dayDate = comparisonData.find((d) => d.day === label)?.date;
                      return (
                        <div className="bg-white text-slate-800 rounded-xl p-3 shadow-lg text-xs space-y-2 border border-slate-200/90 ring-1 ring-black/5 min-w-[210px]">
                          <div className="font-bold border-b border-slate-100 pb-1.5 flex items-center justify-between gap-4">
                            <span className="text-slate-900 font-semibold">{label}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {dayDate}
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-3 text-slate-700">
                              <span className="flex items-center gap-1.5 font-medium">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                                  style={{ backgroundColor: primaryColor }}
                                />
                                This Week
                              </span>
                              <span className="font-mono font-bold text-slate-900">
                                {thisVal.toFixed(2)}h{' '}
                                <span className="text-[10px] font-normal text-slate-400">
                                  ({formatSecondsToHuman(thisVal * 3600)})
                                </span>
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-slate-700">
                              <span className="flex items-center gap-1.5 font-medium">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                                  style={{ backgroundColor: secondaryColor }}
                                />
                                Last Week
                              </span>
                              <span className="font-mono font-bold text-slate-900">
                                {lastVal.toFixed(2)}h{' '}
                                <span className="text-[10px] font-normal text-slate-400">
                                  ({formatSecondsToHuman(lastVal * 3600)})
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ paddingBottom: '10px', fontSize: '12px' }}
                  />
                  <Area
                    type="monotone"
                    name="This Week"
                    dataKey="thisWeek"
                    stroke={primaryColor}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorThisWeek)"
                    isAnimationActive={true}
                    animationDuration={700}
                    animationEasing="ease-out"
                  />
                  <Area
                    type="monotone"
                    name="Last Week"
                    dataKey="lastWeek"
                    stroke={secondaryColor}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    fill="none"
                    isAnimationActive={true}
                    animationDuration={700}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-[11px] text-slate-400 mt-2">
              Comparing daily hours between this Monday–Sunday and previous week.
            </p>
          </div>
        )}

        {/* 2. DAILY BAR CHART */}
        {activeChart === 'bar' && (
          <div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="day"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                    unit="h"
                    domain={[0, yMaxDaily]}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const val = Number(payload[0]?.value || 0);
                      const dayDate = comparisonData.find((d) => d.day === label)?.date;
                      return (
                        <div className="bg-white text-slate-800 rounded-xl p-3 shadow-lg text-xs space-y-1.5 border border-slate-200/90 ring-1 ring-black/5 min-w-[190px]">
                          <div className="font-bold border-b border-slate-100 pb-1 flex items-center justify-between gap-4">
                            <span className="text-slate-900 font-semibold">{label}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {dayDate}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3 text-slate-700">
                            <span className="flex items-center gap-1.5 font-medium">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                                style={{ backgroundColor: primaryColor }}
                              />
                              Hours Logged
                            </span>
                            <span className="font-mono font-bold text-slate-900">
                              {val.toFixed(2)}h
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono text-right">
                            {formatSecondsToHuman(val * 3600)}
                          </div>
                        </div>
                      );
                    }}
                  />
                  {enableGoals && dailyGoalHours > 0 && (
                    <ReferenceLine
                      y={dailyGoalHours}
                      stroke={secondaryColor}
                      strokeDasharray="3 3"
                      strokeWidth={2}
                    />
                  )}
                  {/* Uniform bar styling for all days using primary active theme color */}
                  <Bar 
                    dataKey="thisWeek" 
                    fill={primaryColor} 
                    radius={[6, 6, 0, 0]} 
                    isAnimationActive={true}
                    animationDuration={700}
                    animationEasing="ease-out"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 mt-2">
              <span className="flex items-center gap-1.5 font-medium text-slate-700">
                <span className="w-3 h-3 rounded-xs shadow-2xs" style={{ backgroundColor: primaryColor }}></span> Daily Hours
              </span>
              {enableGoals && dailyGoalHours > 0 && (
                <span className="flex items-center gap-1.5 font-medium" style={{ color: secondaryColor }}>
                  <span className="w-4 h-0.5 border-t-2 border-dashed" style={{ borderColor: secondaryColor }}></span> Daily Target: {dailyGoalHours}h
                </span>
              )}
            </div>
          </div>
        )}

        {/* 3. TIMELINE SESSION SPANS GANTT */}
        {activeChart === 'timeline' && (
          <div className="space-y-3">
            {/* Timeline Header Scale */}
            <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-500 pb-1.5 border-b border-slate-100 font-mono">
              <div className="w-12 sm:w-14 shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Day
              </div>
              <div className="flex-1 relative h-6">
                {/* 3-hour graduation tick lines (0%, 16.667%, 33.333%, 50%, 66.667%, 83.333%, 100%) */}
                {[0, 16.667, 33.333, 50, 66.667, 83.333, 100].map((pct) => (
                  <div
                    key={pct}
                    className="absolute top-3 bottom-0 border-l border-slate-300 -translate-x-1/2"
                    style={{ left: `${pct}%` }}
                  />
                ))}
                {/* 6-hour numbered step labels */}
                {[
                  { label: '6 AM', pct: 0, align: 'left' },
                  { label: '12 PM', pct: 33.333, align: 'center' },
                  { label: '6 PM', pct: 66.667, align: 'center' },
                  { label: '12 AM', pct: 100, align: 'right' },
                ].map((step, idx) => (
                  <span
                    key={idx}
                    className={`absolute top-0 text-[10px] sm:text-xs font-mono text-slate-600 font-bold ${
                      step.align === 'left'
                        ? 'left-0'
                        : step.align === 'right'
                        ? 'right-0'
                        : '-translate-x-1/2'
                    }`}
                    style={step.align === 'center' ? { left: `${step.pct}%` } : undefined}
                  >
                    {step.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Timeline Day Rows */}
            <div className="space-y-2.5">
              {timelineDays.map((dayItem, dIdx) => {
                const hasPunches = dayItem.spans.length > 0;
                const startScale = 6; // 06:00 AM (06:00)
                const endScale = 24; // 12:00 AM / Midnight (24:00)
                const totalSpanHours = endScale - startScale; // 18 hours span

                return (
                  <div key={dIdx} className="flex items-center gap-2 sm:gap-3">
                    <div className="w-12 sm:w-14 text-xs font-bold text-slate-700 flex flex-col shrink-0">
                      <span>{dayItem.day}</span>
                      <span className="text-[10px] font-normal text-slate-400 font-mono">
                        {dayItem.date.slice(5)}
                      </span>
                    </div>

                    <div className="flex-1 h-8 bg-slate-100/80 rounded-lg relative overflow-hidden border border-slate-200/60 flex items-center">
                      {/* 3-hour graduation grid lines */}
                      {[0, 16.667, 33.333, 50, 66.667, 83.333, 100].map((pct) => (
                        <div
                          key={pct}
                          className="absolute top-0 bottom-0 border-l border-slate-200/70"
                          style={{ left: `${pct}%` }}
                        />
                      ))}

                      {hasPunches ? (
                        dayItem.spans.map((span, sIdx) => {
                          const clampedStart = Math.max(startScale, Math.min(endScale, span.startHour));
                          const clampedEnd = Math.max(startScale, Math.min(endScale, span.endHour));
                          
                          if (clampedEnd <= clampedStart && span.endHour < startScale) return null;

                          const leftPct = Math.max(
                            0,
                            Math.min(100, ((clampedStart - startScale) / totalSpanHours) * 100)
                          );
                          const widthPct = Math.max(
                            2,
                            Math.min(
                              100 - leftPct,
                              ((Math.max(clampedStart + 0.1, clampedEnd) - clampedStart) / totalSpanHours) * 100
                            )
                          );

                          return (
                            <div
                              key={sIdx}
                              className="absolute top-1 bottom-1 rounded-md px-2 flex items-center justify-between text-[10px] font-bold text-white shadow-xs group cursor-pointer transition-transform hover:scale-y-110 z-10"
                              style={{ 
                                left: `${leftPct}%`, 
                                width: `${widthPct}%`, 
                                backgroundColor: primaryColor 
                              }}
                              title={`${span.label} (${span.durationFormatted}) ${span.projectName ? `[${span.projectName}]` : ''} ${span.note ? `\nNote: ${span.note}` : ''}`}
                            >
                              <div className="flex items-center gap-1 truncate">
                                {span.projectName && (
                                  <span className="px-1 py-0.2 bg-black/30 text-white rounded-xs text-[9px]">
                                    {span.projectName}
                                  </span>
                                )}
                                <span className="truncate">{span.label}</span>
                              </div>
                              <span className="font-mono text-[9px] opacity-95 hidden sm:inline ml-1">
                                {span.durationFormatted}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="w-full text-center text-[11px] text-slate-400 font-medium italic">
                          no sessions recorded
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
              <span>Hover over session bars to see duration and project annotations.</span>
              <span className="font-medium font-mono" style={{ color: primaryColor }}>
                06:00 AM – 12:00 AM (Midnight)
              </span>
            </div>
          </div>
        )}

        {/* 4. DOUGHNUT RATIO (Comparison chart) */}
        {activeChart === 'doughnut' && (
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 py-2">
            <div className="w-[240px] h-[240px] relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ratioPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                    isAnimationActive={true}
                    animationDuration={700}
                    animationEasing="ease-out"
                  >
                    {ratioPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white text-slate-900 rounded-xl p-3 shadow-xl text-xs space-y-1.5 border border-slate-200 ring-1 ring-black/5 min-w-[170px]">
                          <div className="font-bold border-b border-slate-100 pb-1 flex items-center gap-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                              style={{ backgroundColor: data.color }}
                            />
                            <span className="text-slate-900 font-bold">{data.name}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3 text-slate-700">
                            <span className="text-slate-500 font-medium">Duration:</span>
                            <span className="font-mono font-bold text-slate-900">
                              {data.value} hrs
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3 text-slate-700">
                            <span className="text-slate-500 font-medium">Share:</span>
                            <span className="font-mono font-bold text-slate-900">
                              {data.percent}%
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <div className="text-[11px] font-bold uppercase text-slate-400">Total Hours</div>
                <div className="text-xl font-extrabold font-mono text-slate-900">
                  {(chartData.ratio.weekday + chartData.ratio.weekend).toFixed(1)}h
                </div>
              </div>
            </div>

            {/* Ratio Breakdown List */}
            <div className="space-y-3 w-full max-w-xs">
              <div 
                className="p-3.5 rounded-xl border flex items-center justify-between transition-colors bg-white shadow-2xs"
                style={{ 
                  borderColor: `${primaryColor}40` 
                }}
              >
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5 text-slate-800">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: primaryColor }}></span>
                    Weekday Work
                  </div>
                  <div className="text-lg font-extrabold font-mono text-slate-900 mt-0.5">
                    {chartData.ratio.weekday} hrs
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-extrabold text-slate-900">
                    {chartData.ratio.weekdayPercent}%
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">of total time</div>
                </div>
              </div>

              <div 
                className="p-3.5 rounded-xl border flex items-center justify-between transition-colors bg-white shadow-2xs"
                style={{ 
                  borderColor: `${secondaryColor}40` 
                }}
              >
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5 text-slate-800">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: secondaryColor }}></span>
                    Weekend Work
                  </div>
                  <div className="text-lg font-extrabold font-mono text-slate-900 mt-0.5">
                    {chartData.ratio.weekend} hrs
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-extrabold text-slate-900">
                    {chartData.ratio.weekendPercent}%
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">of total time</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
