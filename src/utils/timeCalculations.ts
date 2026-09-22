import { DayRecord, DashboardMetrics, WeeklyChartData, ShiftSpan, PunchPair, Project, QuarterWeekSummary } from '../types';

export function getQuarterName(date: Date = new Date()): string {
  const month = date.getMonth(); // 0-11
  const quarterNum = Math.floor(month / 3) + 1;
  return `Q${quarterNum} ${date.getFullYear()}`;
}

export function formatDateToYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateMMDDYYYY(val?: string | Date | null): string {
  if (!val) return '';
  if (val instanceof Date) {
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    const y = val.getFullYear();
    return `${m}/${d}/${y}`;
  }
  const str = String(val).trim();
  const parts = str.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [y, m, d] = parts;
    return `${m.padStart(2, '0')}/${d.padStart(2, '0')}/${y}`;
  }
  return str;
}

export function formatTimeToHHMMSS(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function timeToDecimalHours(val?: string | null): number {
  if (!val) return 0;
  const parts = String(val).trim().split(':').map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const s = parts[2] || 0;
  return h + m / 60 + s / 3600;
}

export function parseTimeToSeconds(val?: string | null): number {
  if (!val) return 0;
  const parts = String(val).trim().split(':').map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const s = parts[2] || 0;
  return h * 3600 + m * 60 + s;
}

export function getDurationInSeconds(inVal?: string | null, outVal?: string | null): number {
  if (!inVal || !outVal) return 0;
  const inSec = parseTimeToSeconds(inVal);
  const outSec = parseTimeToSeconds(outVal);
  return Math.max(0, outSec - inSec);
}

export function formatSecondsToHHMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export function formatSecondsToHuman(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  if (h === 0 && m === 0) return `${safe % 60}s`;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function formatDecimalHoursTo12H(dec: number): string {
  const normalized = Math.max(0, Math.min(24, dec));
  const h24 = Math.floor(normalized) % 24;
  const m = Math.round((normalized - Math.floor(normalized)) * 60);
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export function formatTime24to12(time24?: string | null): string {
  if (!time24) return '--';
  const parts = time24.split(':');
  if (parts.length < 2) return time24;
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  const s = parts[2] ? `:${parts[2]}` : '';
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m}${s} ${period}`;
}

export function createEmptyPunches(count: number = 5): PunchPair[] {
  const list: PunchPair[] = [];
  for (let i = 0; i < Math.max(1, count); i++) {
    list.push({ inTime: '', outTime: '', note: '' });
  }
  return list;
}

export function calculateDayTotalSeconds(
  punches: PunchPair[],
  activeLiveInTime?: string | null,
  currentLiveSeconds?: number
): number {
  let totalSec = 0;
  if (!punches || !Array.isArray(punches)) return 0;
  
  for (let i = 0; i < punches.length; i++) {
    const pair = punches[i];
    if (!pair) continue;
    if (pair.inTime && pair.outTime) {
      totalSec += getDurationInSeconds(pair.inTime, pair.outTime);
    } else if (pair.inTime && !pair.outTime && activeLiveInTime === pair.inTime && currentLiveSeconds !== undefined) {
      totalSec += currentLiveSeconds;
    }
  }
  return totalSec;
}

export function getTodayMondayDate(refDate: Date = new Date()): Date {
  const dayOfWeek = refDate.getDay(); // 0 (Sun) - 6 (Sat)
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function calculateMetrics(
  records: DayRecord[],
  todayStr: string = formatDateToYYYYMMDD(new Date()),
  projects: Project[] = []
): DashboardMetrics {
  const now = new Date();
  const monday = getTodayMondayDate(now);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11
  const startOfMonth = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
  const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

  let todaySec = 0;
  let weekSec = 0;
  let monthSec = 0;
  let weekdaySec = 0;
  let weekendSec = 0;
  let quarterSec = 0;
  
  let daysWorkedCount = 0;
  let daysWorkedThisWeek = 0;
  let daysWorkedThisMonth = 0;

  const projectSecondsMap = new Map<string, number>();
  const recentList: DashboardMetrics['recent'] = [];

  // Sort records by date ascending
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));

  for (const record of sorted) {
    if (!record.date) continue;
    const dateObj = new Date(record.date + 'T00:00:00');
    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

    let daySec = 0;
    let lastIn = '--';
    let lastOut = '--';
    let punchCount = 0;
    const projectNamesUsed = new Set<string>();

    const punches = record.punches || [];
    for (let i = 0; i < punches.length; i++) {
      const p = punches[i];
      if (p.inTime) {
        lastIn = p.inTime;
        punchCount++;
      }
      if (p.outTime) {
        lastOut = p.outTime;
        punchCount++;
      }
      if (p.inTime && p.outTime) {
        const dur = getDurationInSeconds(p.inTime, p.outTime);
        daySec += dur;

        const projId = p.projectId || record.primaryProjectId || 'unassigned';
        projectSecondsMap.set(projId, (projectSecondsMap.get(projId) || 0) + dur);

        if (p.projectName) {
          projectNamesUsed.add(p.projectName);
        } else if (p.projectId) {
          const matchProj = projects.find((pr) => pr.id === p.projectId);
          if (matchProj) projectNamesUsed.add(matchProj.name);
        }
      }
    }

    if (daySec > 0 || punchCount > 0) {
      daysWorkedCount++;
    }

    quarterSec += daySec;

    if (isWeekend) {
      weekendSec += daySec;
    } else {
      weekdaySec += daySec;
    }

    // Week metrics
    if (dateObj >= monday && dateObj <= sunday) {
      weekSec += daySec;
      if (daySec > 0 || punchCount > 0) {
        daysWorkedThisWeek++;
      }
    }

    // Month metrics
    if (dateObj >= startOfMonth && dateObj <= endOfMonth) {
      monthSec += daySec;
      if (daySec > 0 || punchCount > 0) {
        daysWorkedThisMonth++;
      }
    }

    if (record.date === todayStr) {
      todaySec += daySec;
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    recentList.push({
      date: record.date,
      dayOfWeek: dayNames[dateObj.getDay()],
      lastIn,
      lastOut,
      punchCount,
      totalSeconds: daySec,
      totalFormatted: formatSecondsToHHMMSS(daySec),
      projectNames: Array.from(projectNamesUsed),
      notes: record.notes,
    });
  }

  // Calculate Streak
  let currentStreak = 0;
  const daysMap = new Map<string, number>();
  sorted.forEach((r) => {
    const sec = (r.punches || []).reduce((acc, p) => acc + (p.inTime && p.outTime ? getDurationInSeconds(p.inTime, p.outTime) : 0), 0);
    if (sec > 0) daysMap.set(r.date, sec);
  });

  const checkDate = new Date(now);
  if (!daysMap.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  for (let i = 0; i < 60; i++) {
    const dateStr = formatDateToYYYYMMDD(checkDate);
    const dayOfWeek = checkDate.getDay();
    if (daysMap.has(dateStr)) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (dayOfWeek === 0 || dayOfWeek === 6) {
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Calculate Weekly and Daily Averages
  // 1. Weekly Average per Month: Total month hours / elapsed weeks in month (days / 7)
  const daysInMonthElapsed = Math.max(1, now.getDate());
  const weeksInMonthElapsed = Math.max(0.5, daysInMonthElapsed / 7);
  const monthHoursTotal = monthSec / 3600;
  const weeklyAvgMonth = monthHoursTotal > 0 ? Number((monthHoursTotal / weeksInMonthElapsed).toFixed(1)) : 0;

  // 2. Weekly Average per Quarter: Total quarter hours / elapsed weeks in quarter
  const qMonthStart = Math.floor(now.getMonth() / 3) * 3;
  const qStartDate = new Date(now.getFullYear(), qMonthStart, 1);
  const diffTime = Math.max(0, now.getTime() - qStartDate.getTime());
  const daysInQuarterElapsed = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);
  const weeksInQuarterElapsed = Math.max(0.5, Math.min(13, daysInQuarterElapsed / 7));
  const quarterHoursTotal = quarterSec / 3600;
  const weeklyAvgQuarter = quarterHoursTotal > 0 ? Number((quarterHoursTotal / weeksInQuarterElapsed).toFixed(1)) : 0;

  // Daily Averages (kept for secondary calculations)
  const currentDayOfWeekIndex = (now.getDay() === 0 ? 7 : now.getDay()); // Mon = 1, Sun = 7
  const activeDaysThisWeek = Math.max(1, daysWorkedThisWeek || currentDayOfWeekIndex);
  const dailyAvgWeek = Number(((weekSec / 3600) / activeDaysThisWeek).toFixed(2));

  const activeDaysThisMonth = Math.max(1, daysWorkedThisMonth || daysInMonthElapsed);
  const dailyAvgMonth = Number(((monthSec / 3600) / activeDaysThisMonth).toFixed(2));

  const activeDaysThisQuarter = Math.max(1, daysWorkedCount);
  const dailyAvgQuarter = Number(((quarterSec / 3600) / activeDaysThisQuarter).toFixed(2));

  const avgHoursPerDay = dailyAvgQuarter;

  // Project Breakdown List
  const projectBreakdown = projects.map((p) => {
    const pSec = projectSecondsMap.get(p.id) || 0;
    const pHours = Number((pSec / 3600).toFixed(2));
    const pPct = quarterSec > 0 ? Math.round((pSec / quarterSec) * 100) : 0;
    return {
      projectId: p.id,
      projectName: p.name,
      color: p.color || '#059669',
      seconds: pSec,
      hours: pHours,
      percentage: pPct,
    };
  }).filter((p) => p.seconds > 0);

  // Unassigned project time
  const unassignedSec = projectSecondsMap.get('unassigned') || 0;
  if (unassignedSec > 0) {
    const unassignedHours = Number((unassignedSec / 3600).toFixed(2));
    const unassignedPct = quarterSec > 0 ? Math.round((unassignedSec / quarterSec) * 100) : 0;
    projectBreakdown.push({
      projectId: 'unassigned',
      projectName: 'General / Unassigned',
      color: '#94a3b8',
      seconds: unassignedSec,
      hours: unassignedHours,
      percentage: unassignedPct,
    });
  }

  return {
    todayFormatted: formatSecondsToHHMMSS(todaySec),
    todaySeconds: todaySec,
    weekFormatted: formatSecondsToHHMMSS(weekSec),
    weekSeconds: weekSec,
    monthFormatted: formatSecondsToHHMMSS(monthSec),
    monthSeconds: monthSec,
    weekdayFormatted: formatSecondsToHHMMSS(weekdaySec),
    weekdaySeconds: weekdaySec,
    weekendFormatted: formatSecondsToHHMMSS(weekendSec),
    weekendSeconds: weekendSec,
    quarterFormatted: formatSecondsToHHMMSS(quarterSec),
    quarterSeconds: quarterSec,
    daysWorkedCount,
    daysWorkedThisWeek,
    daysWorkedThisMonth,
    weeklyAvgMonth,
    weeklyAvgQuarter,
    weeksInMonthElapsed: Number(weeksInMonthElapsed.toFixed(1)),
    weeksInQuarterElapsed: Number(weeksInQuarterElapsed.toFixed(1)),
    dailyAvgWeek,
    dailyAvgMonth,
    dailyAvgQuarter,
    avgHoursPerDay,
    currentStreak,
    recent: recentList.slice(-10).reverse(),
    projectBreakdown,
  };
}

export function getWeeklyChartData(
  records: DayRecord[],
  refDate: Date = new Date(),
  projects: Project[] = []
): WeeklyChartData {
  const thisMon = getTodayMondayDate(refDate);
  const lastMon = new Date(thisMon);
  lastMon.setDate(thisMon.getDate() - 7);

  const thisWeekHours = [0, 0, 0, 0, 0, 0, 0];
  const lastWeekHours = [0, 0, 0, 0, 0, 0, 0];
  const spans: ShiftSpan[][] = [[], [], [], [], [], [], []];
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayDates: string[] = [];

  for (let d = 0; d < 7; d++) {
    const dObj = new Date(thisMon);
    dObj.setDate(thisMon.getDate() + d);
    dayDates.push(formatDateToYYYYMMDD(dObj));
  }

  let totalWeekdayHours = 0;
  let totalWeekendHours = 0;

  for (const record of records) {
    if (!record.date) continue;
    const dateObj = new Date(record.date + 'T00:00:00');
    dateObj.setHours(0, 0, 0, 0);

    let dailySec = 0;
    const punches = record.punches || [];
    for (let i = 0; i < punches.length; i++) {
      const p = punches[i];
      if (p.inTime && p.outTime) {
        dailySec += getDurationInSeconds(p.inTime, p.outTime);
      }
    }
    const hours = dailySec / 3600;

    const day = dateObj.getDay();
    if (day === 0 || day === 6) {
      totalWeekendHours += hours;
    } else {
      totalWeekdayHours += hours;
    }

    // Check if falls in this week (Monday to Sunday)
    const diffThisDays = Math.round((dateObj.getTime() - thisMon.getTime()) / (1000 * 60 * 60 * 24));
    if (diffThisDays >= 0 && diffThisDays < 7) {
      thisWeekHours[diffThisDays] += hours;

      for (let i = 0; i < punches.length; i++) {
        const p = punches[i];
        if (p.inTime && p.outTime) {
          const start = timeToDecimalHours(p.inTime);
          const end = timeToDecimalHours(p.outTime);
          if (end > start) {
            const durSec = getDurationInSeconds(p.inTime, p.outTime);
            const matchProject = projects.find((pr) => pr.id === p.projectId);
            spans[diffThisDays].push({
              startHour: start,
              endHour: end,
              label: `${formatTime24to12(p.inTime)} – ${formatTime24to12(p.outTime)}`,
              durationFormatted: formatSecondsToHuman(durSec),
              projectName: matchProject?.name || p.projectName,
              projectColor: matchProject?.color,
              note: p.note,
            });
          }
        }
      }
    }

    // Check if falls in last week
    const diffLastDays = Math.round((dateObj.getTime() - lastMon.getTime()) / (1000 * 60 * 60 * 24));
    if (diffLastDays >= 0 && diffLastDays < 7) {
      lastWeekHours[diffLastDays] += hours;
    }
  }

  const totalSum = totalWeekdayHours + totalWeekendHours;
  const weekdayPercent = totalSum > 0 ? Math.round((totalWeekdayHours / totalSum) * 100) : 100;
  const weekendPercent = totalSum > 0 ? Math.round((totalWeekendHours / totalSum) * 100) : 0;

  return {
    thisWeek: thisWeekHours.map((h) => Number(h.toFixed(2))),
    lastWeek: lastWeekHours.map((h) => Number(h.toFixed(2))),
    spans,
    dayLabels,
    dayDates,
    ratio: {
      weekday: Number(totalWeekdayHours.toFixed(2)),
      weekend: Number(totalWeekendHours.toFixed(2)),
      weekdayPercent,
      weekendPercent,
    },
  };
}

export function generateQuarterCSV(
  quarterName: string,
  records: DayRecord[],
  projects: Project[] = []
): string {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  
  let maxSlots = 5;
  for (const r of sorted) {
    if (r.punches && r.punches.length > maxSlots) {
      maxSlots = r.punches.length;
    }
  }

  const rows: string[] = [];

  // If projects exist, prepend project metadata section with '# PROJECT:' prefix for clean, backwards-compatible parsing
  const activeProjects = projects.filter(p => !p.isDeleted);
  if (activeProjects.length > 0) {
    rows.push('# PROJECTS_SECTION');
    rows.push('# Project Name,Client,Color Hex,Description,Project ID');
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
  }

  const headers = ['Date'];
  for (let s = 1; s <= maxSlots; s++) {
    headers.push(`Time In ${s}`, `Time Out ${s}`, `Project ${s}`, `Note ${s}`);
  }
  headers.push('Day Notes', 'Total Hours');

  rows.push(headers.join(','));

  for (const rec of sorted) {
    let daySec = 0;
    const punchCells: string[] = [];

    const punches = rec.punches || [];
    for (let i = 0; i < maxSlots; i++) {
      const p = punches[i] || { inTime: '', outTime: '', note: '' };
      punchCells.push(`"${p.inTime || ''}"`);
      punchCells.push(`"${p.outTime || ''}"`);
      
      const projName = p.projectName || projects.find((pr) => pr.id === p.projectId)?.name || '';
      punchCells.push(`"${projName.replace(/"/g, '""')}"`);
      punchCells.push(`"${(p.note || '').replace(/"/g, '""')}"`);

      if (p.inTime && p.outTime) {
        daySec += getDurationInSeconds(p.inTime, p.outTime);
      }
    }

    const dayNotesClean = (rec.notes || '').replace(/"/g, '""');
    const row = [
      rec.date,
      ...punchCells,
      `"${dayNotesClean}"`,
      formatSecondsToHHMMSS(daySec),
    ];
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

export interface CSVParseResult {
  records: DayRecord[];
  projects: Project[];
}

export function parseCSVToRecordsAndProjects(csvText: string, existingProjects: Project[] = []): CSVParseResult {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length === 0) return { records: [], projects: [] };

  const parsedProjects: Project[] = [];
  const records: DayRecord[] = [];
  let inProjectsSection = false;

  // Helper to split a CSV line respecting double quotes
  const parseLine = (line: string): string[] => {
    const cols: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') {
        if (inQuotes && line[c + 1] === '"') {
          cur += '"';
          c++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cols.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur.trim());
    return cols;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    // Check project metadata section
    if (rawLine === '# PROJECTS_SECTION') {
      inProjectsSection = true;
      continue;
    }
    if (rawLine === '# END_PROJECTS_SECTION') {
      inProjectsSection = false;
      continue;
    }

    if (inProjectsSection) {
      if (rawLine.startsWith('# Project Name') || rawLine === '#') continue;
      // Strip leading '# ' or '#'
      const projLine = rawLine.replace(/^#\s*/, '');
      const pCols = parseLine(projLine).map(c => c.replace(/^["']|["']$/g, '').trim());
      if (pCols.length >= 1 && pCols[0]) {
        const pName = pCols[0];
        const pClient = pCols[1] || undefined;
        const pColor = pCols[2] && pCols[2].startsWith('#') ? pCols[2] : '#0284C7';
        const pDesc = pCols[3] || undefined;
        const pId = pCols[4] || `proj-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

        parsedProjects.push({
          id: pId,
          name: pName,
          client: pClient,
          color: pColor,
          description: pDesc,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      continue;
    }

    // Skip comment lines
    if (rawLine.startsWith('#')) continue;

    // If it's the header row for records, skip
    if (rawLine.startsWith('Date,') || rawLine.startsWith('"Date",') || rawLine.toLowerCase().startsWith('date')) {
      continue;
    }

    const cols = parseLine(rawLine);
    const date = cols[0]?.replace(/^["']|["']$/g, '');
    if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) continue;

    const punches: PunchPair[] = [];
    const isNewFormat = cols.length > 12;
    const stride = isNewFormat ? 4 : 2;

    for (let p = 1; p < cols.length - 2; p += stride) {
      const inVal = (cols[p] || '').replace(/^["']|["']$/g, '');
      const outVal = (cols[p + 1] || '').replace(/^["']|["']$/g, '');
      const projName = isNewFormat ? (cols[p + 2] || '').replace(/^["']|["']$/g, '') : '';
      const noteVal = isNewFormat ? (cols[p + 3] || '').replace(/^["']|["']$/g, '') : '';

      if (inVal.includes(':') || outVal.includes(':') || inVal !== '' || outVal !== '') {
        punches.push({
          inTime: inVal.trim(),
          outTime: outVal.trim(),
          projectName: projName.trim(),
          note: noteVal.trim(),
        });
      } else if (punches.length < 5) {
        punches.push({ inTime: '', outTime: '' });
      }
    }

    while (punches.length < 5) {
      punches.push({ inTime: '', outTime: '' });
    }

    const dayNotes = cols[cols.length - 2]?.replace(/^["']|["']$/g, '') || '';

    records.push({
      date,
      punches,
      notes: dayNotes,
    });
  }

  // Also auto-discover any new project names found in punches that weren't in project definitions
  const allKnownNames = new Set([
    ...existingProjects.map(p => p.name.toLowerCase().trim()),
    ...parsedProjects.map(p => p.name.toLowerCase().trim()),
  ]);

  const defaultColors = ['#0284C7', '#15803D', '#8B5CF6', '#D97706', '#D65467', '#0D9488'];
  let colorIdx = 0;

  for (const r of records) {
    for (const p of r.punches || []) {
      if (p.projectName && p.projectName.trim() && !p.projectName.toLowerCase().includes('(sample)')) {
        const cleanName = p.projectName.trim();
        if (!allKnownNames.has(cleanName.toLowerCase())) {
          allKnownNames.add(cleanName.toLowerCase());
          parsedProjects.push({
            id: `proj-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            name: cleanName,
            color: defaultColors[colorIdx % defaultColors.length],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          colorIdx++;
        }
      }
    }
  }

  return { records, projects: parsedProjects };
}

export function parseCSVToRecords(csvText: string): DayRecord[] {
  return parseCSVToRecordsAndProjects(csvText).records;
}

export function getWeekOfYear(d: Date): number {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.getTime();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.getTime()) / 604800000);
}

export function formatWeekRangeShort(mondayDate: Date): string {
  const sundayDate = new Date(mondayDate);
  sundayDate.setDate(mondayDate.getDate() + 6);
  
  const mMonth = mondayDate.toLocaleDateString('en-US', { month: 'short' });
  const mDay = mondayDate.getDate();
  const sMonth = sundayDate.toLocaleDateString('en-US', { month: 'short' });
  const sDay = sundayDate.getDate();
  
  if (mMonth === sMonth) {
    return `${mMonth} ${mDay} – ${sDay}`;
  }
  return `${mMonth} ${mDay} – ${sMonth} ${sDay}`;
}

export function formatWeekRangeFull(mondayDate: Date): string {
  const sundayDate = new Date(mondayDate);
  sundayDate.setDate(mondayDate.getDate() + 6);
  
  const mMonth = mondayDate.toLocaleDateString('en-US', { month: 'short' });
  const mDay = mondayDate.getDate();
  const sMonth = sundayDate.toLocaleDateString('en-US', { month: 'short' });
  const sDay = sundayDate.getDate();
  const sYear = sundayDate.getFullYear();
  
  if (mMonth === sMonth) {
    return `${mMonth} ${mDay} – ${sDay}, ${sYear}`;
  }
  return `${mMonth} ${mDay} – ${sMonth} ${sDay}, ${sYear}`;
}

export function getQuarterWeeksBreakdown(
  records: DayRecord[],
  quarterName: string = getQuarterName(),
  liveExtraSeconds: number = 0,
  refDate: Date = new Date()
): QuarterWeekSummary[] {
  // Determine quarter start & end dates
  const match = quarterName.match(/Q([1-4])\s*(\d{4})/i);
  let qStartMonth = Math.floor(refDate.getMonth() / 3) * 3;
  let qYear = refDate.getFullYear();
  
  if (match) {
    const qNum = parseInt(match[1], 10);
    qStartMonth = (qNum - 1) * 3;
    qYear = parseInt(match[2], 10);
  }
  
  const qStartDate = new Date(qYear, qStartMonth, 1, 0, 0, 0, 0);
  const qEndDate = new Date(qYear, qStartMonth + 3, 0, 23, 59, 59, 999);
  
  // First Monday of the quarter (the Monday on or before the 1st day of the quarter)
  const firstMonday = getTodayMondayDate(qStartDate);
  const currentMonday = getTodayMondayDate(refDate);
  const currentMondayStr = formatDateToYYYYMMDD(currentMonday);
  
  // Index all records by date for fast lookup
  const recordMap = new Map<string, DayRecord>();
  for (const r of records) {
    if (r.date) {
      recordMap.set(r.date, r);
    }
  }

  const summaries: QuarterWeekSummary[] = [];
  let weekIndex = 1;
  const iterMonday = new Date(firstMonday);

  // Iterate week by week across the quarter
  while (iterMonday <= qEndDate) {
    const iterSunday = new Date(iterMonday);
    iterSunday.setDate(iterMonday.getDate() + 6);
    iterSunday.setHours(23, 59, 59, 999);

    const startStr = formatDateToYYYYMMDD(iterMonday);
    const endStr = formatDateToYYYYMMDD(iterSunday);

    const isCurrent = startStr === currentMondayStr;
    const isPast = iterSunday.getTime() < currentMonday.getTime();
    const isFuture = iterMonday.getTime() > currentMonday.getTime();

    let totalSec = 0;
    let daysWorked = 0;
    const dailyHours: number[] = [0, 0, 0, 0, 0, 0, 0];
    const dailyDates: string[] = [];

    for (let d = 0; d < 7; d++) {
      const dObj = new Date(iterMonday);
      dObj.setDate(iterMonday.getDate() + d);
      const dStr = formatDateToYYYYMMDD(dObj);
      dailyDates.push(dStr);

      const rec = recordMap.get(dStr);
      let daySec = 0;
      if (rec && rec.punches) {
        for (const p of rec.punches) {
          if (p.inTime && p.outTime) {
            daySec += getDurationInSeconds(p.inTime, p.outTime);
          }
        }
      }

      // If current week and current day is today, add liveExtraSeconds
      if (isCurrent && dStr === formatDateToYYYYMMDD(refDate) && liveExtraSeconds > 0) {
        daySec += liveExtraSeconds;
      }

      if (daySec > 0) {
        daysWorked++;
      }

      totalSec += daySec;
      dailyHours[d] = Number((daySec / 3600).toFixed(2));
    }

    const weekYr = getWeekOfYear(iterMonday);

    summaries.push({
      weekNumber: weekIndex,
      weekOfYear: weekYr,
      weekLabel: `Week ${weekYr}`,
      startDate: new Date(iterMonday),
      endDate: new Date(iterSunday),
      startDateStr: startStr,
      endDateStr: endStr,
      dateRangeFormatted: formatWeekRangeShort(iterMonday),
      totalSeconds: totalSec,
      totalHours: Number((totalSec / 3600).toFixed(2)),
      formattedDuration: formatSecondsToHuman(totalSec),
      daysWorked,
      isCurrentWeek: isCurrent,
      isPastWeek: isPast,
      isFutureWeek: isFuture,
      dailyHours,
      dailyDates,
    });

    weekIndex++;
    iterMonday.setDate(iterMonday.getDate() + 7);
  }

  return summaries;
}

