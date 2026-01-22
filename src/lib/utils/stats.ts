import { entryQueries } from '$lib/db';
import { getNextStatHoliday, getStatQualifyingWindow } from '$lib/constants/statHolidays';
import type { User } from '$lib/db';

export interface StatHolidayStatus {
  nextHoliday: {
    name: string;
    date: string;
    daysUntil: number;
  } | null;
  qualifyingWindow: {
    start: string;
    end: string;
  } | null;
  daysWorked: number;
  daysRequired: number;
  qualificationPercent: number;
  estimatedPay: number;
  fullPay: number;
}

export interface AverageHoursStatus {
  currentHours: number;
  targetHours: number;
  progressPercent: number;
  daysRemaining: number;
  hoursNeeded: number;
  pacePerDay: number;
  onTrack: boolean;
}

// Calculate stat holiday qualification status
export async function getStatHolidayStatus(user: User | null): Promise<StatHolidayStatus> {
  const nextHoliday = getNextStatHoliday();

  if (!nextHoliday) {
    return {
      nextHoliday: null,
      qualifyingWindow: null,
      daysWorked: 0,
      daysRequired: 15,
      qualificationPercent: 0,
      estimatedPay: 0,
      fullPay: 0
    };
  }

  const today = new Date();
  const statDate = new Date(nextHoliday.date);
  const daysUntil = Math.ceil((statDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const window = getStatQualifyingWindow(nextHoliday.date);

  // Get days worked in the qualifying window
  const daysWorked = await entryQueries.getWorkDaysCount(window.start, window.end);

  const daysRequired = 15;
  const qualificationPercent = Math.min((daysWorked / daysRequired) * 100, 100);

  // Calculate stat pay (8 hours at day rate)
  const dayRate = user?.day_rate || 0;
  const fullPay = 8 * dayRate;
  const estimatedPay = (qualificationPercent / 100) * fullPay;

  return {
    nextHoliday: {
      name: nextHoliday.name,
      date: nextHoliday.date,
      daysUntil
    },
    qualifyingWindow: window,
    daysWorked,
    daysRequired,
    qualificationPercent,
    estimatedPay,
    fullPay
  };
}

// Calculate average hours status for board move
// Board moves happen every 6 months (Jan-Jun and Jul-Dec)
export async function getAverageHoursStatus(user: User | null): Promise<AverageHoursStatus> {
  const targetHours = user?.average_hours_target || 600;

  // Get current 6-month period (Jan-Jun or Jul-Dec)
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  let periodStart: Date;
  let periodEnd: Date;

  if (month < 6) {
    // January - June period
    periodStart = new Date(year, 0, 1);
    periodEnd = new Date(year, 5, 30);
  } else {
    // July - December period
    periodStart = new Date(year, 6, 1);
    periodEnd = new Date(year, 11, 31);
  }

  const startDate = periodStart.toISOString().split('T')[0];
  const endDate = periodEnd.toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];

  // Get hours worked so far this period
  const currentHours = await entryQueries.getTotalHours(startDate, todayStr);

  // Calculate days remaining in the period
  const daysRemaining = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Calculate hours still needed
  const hoursNeeded = Math.max(targetHours - currentHours, 0);

  // Calculate required pace (hours per day)
  const pacePerDay = daysRemaining > 0 ? hoursNeeded / daysRemaining : 0;

  // Calculate progress
  const progressPercent = Math.min((currentHours / targetHours) * 100, 100);

  // Determine if on track (assuming ~8 hours per work day, ~5 days per week)
  // If pace needed is more than 8 hours/day on work days, not on track
  const workDaysRemaining = Math.floor(daysRemaining * (5 / 7)); // Rough estimate
  const pacePerWorkDay = workDaysRemaining > 0 ? hoursNeeded / workDaysRemaining : 0;
  const onTrack = pacePerWorkDay <= 8;

  return {
    currentHours,
    targetHours,
    progressPercent,
    daysRemaining,
    hoursNeeded,
    pacePerDay,
    onTrack
  };
}

// Calculate earnings for a given period
export interface PeriodEarnings {
  totalHours: number;
  totalEarnings: number;
  entryCount: number;
  averagePerEntry: number;
  averagePerHour: number;
}

export async function getPeriodEarnings(startDate: string, endDate: string): Promise<PeriodEarnings> {
  const [totalHours, totalEarnings, entries] = await Promise.all([
    entryQueries.getTotalHours(startDate, endDate),
    entryQueries.getTotalEarnings(startDate, endDate),
    entryQueries.getWorkDaysCount(startDate, endDate)
  ]);

  const entryCount = entries;
  const averagePerEntry = entryCount > 0 ? totalEarnings / entryCount : 0;
  const averagePerHour = totalHours > 0 ? totalEarnings / totalHours : 0;

  return {
    totalHours,
    totalEarnings,
    entryCount,
    averagePerEntry,
    averagePerHour
  };
}
