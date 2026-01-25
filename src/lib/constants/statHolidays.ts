// BC Statutory Holidays for ILWU Local 502
// These dates include specific qualification periods

import { statHolidayQueries } from '$lib/db/queries';

export interface StatHoliday {
  name: string;
  date: string; // YYYY-MM-DD format
  qualificationStart: string; // Start of 30-day qualification window
  qualificationEnd: string; // End of 30-day qualification window
  payDate?: string; // When stat pay is received
}

// Cache for database-loaded holidays
let dbHolidaysCache: Map<number, StatHoliday[]> = new Map();
let cacheLoaded = false;

// Load holidays from database into cache
export async function loadStatHolidaysFromDb(): Promise<void> {
  try {
    const dbHolidays = await statHolidayQueries.getAll();
    dbHolidaysCache = new Map();

    for (const h of dbHolidays) {
      const year = h.year;
      if (!dbHolidaysCache.has(year)) {
        dbHolidaysCache.set(year, []);
      }
      dbHolidaysCache.get(year)!.push({
        name: h.name,
        date: h.date,
        qualificationStart: h.qualification_start,
        qualificationEnd: h.qualification_end,
        payDate: h.pay_date || undefined
      });
    }
    cacheLoaded = true;
  } catch (error) {
    console.error('Failed to load stat holidays from database:', error);
  }
}

// Get holidays from database cache for a year
function getDbHolidaysForYear(year: number): StatHoliday[] | null {
  if (!cacheLoaded) return null;
  return dbHolidaysCache.get(year) || null;
}

// Function to get Easter Sunday date (used for Good Friday and Easter Monday)
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// Function to get the nth weekday of a month (e.g., 2nd Monday)
function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();
  let day = 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7;
  return new Date(year, month, day);
}

// 2026 Stat Holidays with exact qualification periods from ILWU schedule
const STAT_HOLIDAYS_2026: StatHoliday[] = [
  {
    name: "New Year's Day",
    date: '2026-01-01',
    qualificationStart: '2025-11-30',
    qualificationEnd: '2025-12-27',
    payDate: '2026-01-08'
  },
  {
    name: 'Family Day',
    date: '2026-02-16',
    qualificationStart: '2026-01-18',
    qualificationEnd: '2026-02-14',
    payDate: '2026-02-26'
  },
  {
    name: 'Good Friday',
    date: '2026-04-03',
    qualificationStart: '2026-03-01',
    qualificationEnd: '2026-03-28',
    payDate: '2026-04-09'
  },
  {
    name: 'Easter Monday',
    date: '2026-04-06',
    qualificationStart: '2026-03-08',
    qualificationEnd: '2026-04-04',
    payDate: '2026-04-16'
  },
  {
    name: 'Victoria Day',
    date: '2026-05-18',
    qualificationStart: '2026-04-19',
    qualificationEnd: '2026-05-16',
    payDate: '2026-05-28'
  },
  {
    name: 'Canada Day',
    date: '2026-07-01',
    qualificationStart: '2026-05-31',
    qualificationEnd: '2026-06-27',
    payDate: '2026-07-09'
  },
  {
    name: 'BC Day',
    date: '2026-08-03',
    qualificationStart: '2026-07-05',
    qualificationEnd: '2026-08-01',
    payDate: '2026-08-13'
  },
  {
    name: 'Labour Day',
    date: '2026-09-07',
    qualificationStart: '2026-08-09',
    qualificationEnd: '2026-09-05',
    payDate: '2026-09-17'
  },
  {
    name: 'Truth & Reconciliation',
    date: '2026-09-30',
    qualificationStart: '2026-08-30',
    qualificationEnd: '2026-09-26',
    payDate: '2026-10-08'
  },
  {
    name: 'Thanksgiving',
    date: '2026-10-12',
    qualificationStart: '2026-09-13',
    qualificationEnd: '2026-10-10',
    payDate: '2026-10-22'
  },
  {
    name: 'Remembrance Day',
    date: '2026-11-11',
    qualificationStart: '2026-10-13',
    qualificationEnd: '2026-11-07',
    payDate: '2026-11-19'
  },
  {
    name: 'Christmas',
    date: '2026-12-25',
    qualificationStart: '2026-11-22',
    qualificationEnd: '2026-12-19',
    payDate: '2026-12-31'
  },
  {
    name: 'Boxing Day',
    date: '2026-12-26',
    qualificationStart: '2026-11-22',
    qualificationEnd: '2026-12-19',
    payDate: '2026-12-31'
  }
];

// 2027 Stat Holidays (partial - more can be added)
const STAT_HOLIDAYS_2027: StatHoliday[] = [
  {
    name: "New Year's Day",
    date: '2027-01-01',
    qualificationStart: '2026-11-29',
    qualificationEnd: '2026-12-26',
    payDate: '2027-01-07'
  }
];

// Get stat holidays for a given year
export function getStatHolidaysForYear(year: number): StatHoliday[] {
  // First check database cache
  const dbHolidays = getDbHolidaysForYear(year);
  if (dbHolidays && dbHolidays.length > 0) {
    return dbHolidays;
  }

  // Fall back to hardcoded data for 2026 and 2027
  if (year === 2026) {
    return STAT_HOLIDAYS_2026;
  }
  if (year === 2027) {
    return STAT_HOLIDAYS_2027;
  }

  // For other years, calculate dynamically with estimated qualification periods
  const holidays: StatHoliday[] = [];

  // Helper to calculate qualification window (approx 28-30 days before stat, ending ~2-4 days before)
  function calcQualWindow(statDate: string): { start: string; end: string } {
    const date = new Date(statDate);
    const end = new Date(date);
    end.setDate(date.getDate() - 4); // End ~4 days before stat
    const start = new Date(end);
    start.setDate(end.getDate() - 27); // ~28 day window
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  }

  // New Year's Day - January 1
  const newYears = `${year}-01-01`;
  const newYearsWindow = calcQualWindow(newYears);
  holidays.push({
    name: "New Year's Day",
    date: newYears,
    qualificationStart: newYearsWindow.start,
    qualificationEnd: newYearsWindow.end
  });

  // Family Day - 3rd Monday of February
  const familyDay = getNthWeekdayOfMonth(year, 1, 1, 3);
  const familyDayStr = familyDay.toISOString().split('T')[0];
  const familyWindow = calcQualWindow(familyDayStr);
  holidays.push({
    name: 'Family Day',
    date: familyDayStr,
    qualificationStart: familyWindow.start,
    qualificationEnd: familyWindow.end
  });

  // Good Friday - Friday before Easter
  const easter = getEasterDate(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  const goodFridayStr = goodFriday.toISOString().split('T')[0];
  const goodFridayWindow = calcQualWindow(goodFridayStr);
  holidays.push({
    name: 'Good Friday',
    date: goodFridayStr,
    qualificationStart: goodFridayWindow.start,
    qualificationEnd: goodFridayWindow.end
  });

  // Easter Monday
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  const easterMondayStr = easterMonday.toISOString().split('T')[0];
  const easterMondayWindow = calcQualWindow(easterMondayStr);
  holidays.push({
    name: 'Easter Monday',
    date: easterMondayStr,
    qualificationStart: easterMondayWindow.start,
    qualificationEnd: easterMondayWindow.end
  });

  // Victoria Day - Monday before May 25
  const may25 = new Date(year, 4, 25);
  const victoriaDay = new Date(year, 4, 25 - ((may25.getDay() + 6) % 7 || 7));
  const victoriaDayStr = victoriaDay.toISOString().split('T')[0];
  const victoriaWindow = calcQualWindow(victoriaDayStr);
  holidays.push({
    name: 'Victoria Day',
    date: victoriaDayStr,
    qualificationStart: victoriaWindow.start,
    qualificationEnd: victoriaWindow.end
  });

  // Canada Day - July 1 (observed Monday if falls on Sunday)
  let canadaDay = new Date(year, 6, 1);
  if (canadaDay.getDay() === 0) {
    canadaDay = new Date(year, 6, 2);
  }
  const canadaDayStr = canadaDay.toISOString().split('T')[0];
  const canadaWindow = calcQualWindow(canadaDayStr);
  holidays.push({
    name: 'Canada Day',
    date: canadaDayStr,
    qualificationStart: canadaWindow.start,
    qualificationEnd: canadaWindow.end
  });

  // BC Day - 1st Monday of August
  const bcDay = getNthWeekdayOfMonth(year, 7, 1, 1);
  const bcDayStr = bcDay.toISOString().split('T')[0];
  const bcWindow = calcQualWindow(bcDayStr);
  holidays.push({
    name: 'BC Day',
    date: bcDayStr,
    qualificationStart: bcWindow.start,
    qualificationEnd: bcWindow.end
  });

  // Labour Day - 1st Monday of September
  const labourDay = getNthWeekdayOfMonth(year, 8, 1, 1);
  const labourDayStr = labourDay.toISOString().split('T')[0];
  const labourWindow = calcQualWindow(labourDayStr);
  holidays.push({
    name: 'Labour Day',
    date: labourDayStr,
    qualificationStart: labourWindow.start,
    qualificationEnd: labourWindow.end
  });

  // National Day for Truth and Reconciliation - September 30
  const truthStr = `${year}-09-30`;
  const truthWindow = calcQualWindow(truthStr);
  holidays.push({
    name: 'Truth & Reconciliation',
    date: truthStr,
    qualificationStart: truthWindow.start,
    qualificationEnd: truthWindow.end
  });

  // Thanksgiving Day - 2nd Monday of October
  const thanksgiving = getNthWeekdayOfMonth(year, 9, 1, 2);
  const thanksgivingStr = thanksgiving.toISOString().split('T')[0];
  const thanksgivingWindow = calcQualWindow(thanksgivingStr);
  holidays.push({
    name: 'Thanksgiving',
    date: thanksgivingStr,
    qualificationStart: thanksgivingWindow.start,
    qualificationEnd: thanksgivingWindow.end
  });

  // Remembrance Day - November 11
  const remembranceStr = `${year}-11-11`;
  const remembranceWindow = calcQualWindow(remembranceStr);
  holidays.push({
    name: 'Remembrance Day',
    date: remembranceStr,
    qualificationStart: remembranceWindow.start,
    qualificationEnd: remembranceWindow.end
  });

  // Christmas Day - December 25
  const christmasStr = `${year}-12-25`;
  const christmasWindow = calcQualWindow(christmasStr);
  holidays.push({
    name: 'Christmas',
    date: christmasStr,
    qualificationStart: christmasWindow.start,
    qualificationEnd: christmasWindow.end
  });

  // Boxing Day - December 26
  const boxingStr = `${year}-12-26`;
  const boxingWindow = calcQualWindow(boxingStr);
  holidays.push({
    name: 'Boxing Day',
    date: boxingStr,
    qualificationStart: boxingWindow.start,
    qualificationEnd: boxingWindow.end
  });

  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

// Get the next upcoming stat holiday
export function getNextStatHoliday(): StatHoliday | null {
  const today = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();

  // Get holidays for current and next year
  const holidays = [
    ...getStatHolidaysForYear(currentYear),
    ...getStatHolidaysForYear(currentYear + 1)
  ];

  return holidays.find(h => h.date >= today) || null;
}

// Get the qualifying window for a stat holiday (kept for backward compatibility)
export function getStatQualifyingWindow(statDate: string): { start: string; end: string } {
  const currentYear = new Date().getFullYear();
  const holidays = [
    ...getStatHolidaysForYear(currentYear),
    ...getStatHolidaysForYear(currentYear + 1)
  ];

  const holiday = holidays.find(h => h.date === statDate);
  if (holiday) {
    return {
      start: holiday.qualificationStart,
      end: holiday.qualificationEnd
    };
  }

  // Fallback to calculated window if not found
  const statDateObj = new Date(statDate);
  const endDate = new Date(statDateObj);
  endDate.setDate(statDateObj.getDate() - 4);
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 27);

  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0]
  };
}

// Format date for display (e.g., "Nov 30" or "Nov 30, 2025")
export function formatQualificationDate(dateStr: string, includeYear = false): string {
  const date = new Date(dateStr + 'T00:00:00');
  if (includeYear) {
    return date.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return date.toLocaleDateString('default', { month: 'short', day: 'numeric' });
}
