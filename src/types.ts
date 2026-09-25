export interface Project {
  id: string;
  name: string;
  client?: string;
  billableRate?: number; // Optional hourly rate (e.g. 75 for $75.00/hr)
  color: string; // Hex color (e.g. #059669, #2563eb, #8b5cf6, #d97706, #ec4899)
  description?: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
  isDeleted?: boolean;
  archived?: boolean;
}

export interface PunchPair {
  inTime?: string; // "HH:mm:ss" or "HH:mm"
  outTime?: string; // "HH:mm:ss" or "HH:mm"
  inDate?: string; // "YYYY-MM-DD"
  outDate?: string; // "YYYY-MM-DD"
  sessionId?: string; // Unique ID linking multi-day / cross-midnight segments
  isMultiDaySegment?: boolean;
  segmentIndex?: number;
  totalSegments?: number;
  totalSessionSeconds?: number;
  projectId?: string;
  projectName?: string;
  note?: string; // Objectives accomplished or session notes
  inNote?: string;
  outNote?: string;
}

export interface DayRecord {
  date: string; // "YYYY-MM-DD"
  punches: PunchPair[];
  notes?: string;
  primaryProjectId?: string;
  updatedAt?: string; // ISO timestamp for conflict-free sync
}

export interface SyncTombstones {
  sessionIds: Record<string, string>; // sessionId or multiDaySig -> deletedAt ISO string
  dates: Record<string, string>;      // dateStr -> deletedAt ISO string
}

export interface QuarterData {
  quarterName: string; // e.g. "Q1 2026"
  records: DayRecord[];
}

export interface RecentEntry {
  date: string;
  dayOfWeek: string;
  lastIn: string;
  lastOut: string;
  punchCount: number;
  totalSeconds: number;
  totalFormatted: string;
  projectNames?: string[];
  notes?: string;
}

export interface DashboardMetrics {
  todayFormatted: string;
  todaySeconds: number;
  weekFormatted: string;
  weekSeconds: number;
  monthFormatted: string;
  monthSeconds: number;
  weekdayFormatted: string;
  weekdaySeconds: number;
  weekendFormatted: string;
  weekendSeconds: number;
  quarterFormatted: string;
  quarterSeconds: number;
  daysWorkedCount: number;
  daysWorkedThisWeek: number;
  daysWorkedThisMonth: number;
  
  // Weekly Averages
  weeklyAvgMonth: number; // Avg hours/week for current month
  weeklyAvgQuarter: number; // Avg hours/week for active quarter
  weeksInMonthElapsed?: number;
  weeksInQuarterElapsed?: number;

  // Daily Averages (kept for compatibility)
  dailyAvgWeek: number; // Avg hours/day for current week
  dailyAvgMonth: number; // Avg hours/day for current month
  dailyAvgQuarter: number; // Avg hours/day for active quarter
  avgHoursPerDay: number; // General avg hours per active day

  currentStreak: number;
  recent: RecentEntry[];
  projectBreakdown?: {
    projectId: string;
    projectName: string;
    color: string;
    seconds: number;
    hours: number;
    percentage: number;
  }[];
}

export interface ShiftSpan {
  startHour: number; // e.g. 9.25 (9:15 AM)
  endHour: number;   // e.g. 17.5 (5:30 PM)
  label: string;
  durationFormatted: string;
  projectName?: string;
  projectColor?: string;
  note?: string;
}

export interface QuarterWeekSummary {
  weekNumber: number;
  weekOfYear?: number;
  weekLabel: string;
  startDate: Date;
  endDate: Date;
  startDateStr: string;
  endDateStr: string;
  dateRangeFormatted: string;
  totalSeconds: number;
  totalHours: number;
  formattedDuration: string;
  daysWorked: number;
  isCurrentWeek: boolean;
  isPastWeek: boolean;
  isFutureWeek: boolean;
  dailyHours: number[];
  dailyDates: string[];
}

export interface WeeklyChartData {
  thisWeek: number[]; // Hours per day Mon..Sun
  lastWeek: number[]; // Hours per day Mon..Sun
  spans: ShiftSpan[][]; // 7 days of shift spans
  dayLabels: string[];
  dayDates: string[];
  ratio: {
    weekday: number;
    weekend: number;
    weekdayPercent: number;
    weekendPercent: number;
  };
}

export type TextSizeOption = 'default' | 'large' | 'larger' | 'largest';

export interface AppSettings {
  appTitle?: string; // Custom app name/label e.g. "Session Time Tracker" or custom workspace
  userName: string;
  userEmail?: string;
  themeColor?: string; // Custom hex code or preset for buttons & UI accents (default #059669)
  chartColor?: string; // Custom hex code for graphs & analytics (default #059669)
  textSize?: TextSizeOption; // Font size scaling: default (100%), large (+1: 110%), larger (+2: 120%), largest (+3: 130%)
  enableGoals: boolean;
  enableProjects: boolean;
  enableStreaks: boolean; // default false as requested
  showFloatingClockBubble?: boolean; // Persistent clock bubble on non-clock tabs
  weeklyGoalHours: number;
  dailyGoalHours: number;
  soundEnabled: boolean;
  gasEndpointUrl?: string; // Optional Google Apps Script Web App URL
  timeFormat24h: boolean;
  lastSyncedAt?: string;
}

export type ChartViewType = 'line' | 'bar' | 'timeline' | 'doughnut';

export type SyncStatusType = 'synced' | 'syncing' | 'offline' | 'error' | 'local';

export type SuggestionStatus = 'new' | 'reviewed' | 'in_progress' | 'completed';

export interface SuggestionTicket {
  id: string;
  ticketId?: string; // e.g. CR-2026-001
  name?: string;
  email?: string;
  category: string;
  message: string;
  createdAt: string;
  status?: SuggestionStatus;
  creatorNotes?: string;
  emailDispatched?: boolean;
  emailDispatchError?: string;
  userAgent?: string;
  ip?: string;
}
