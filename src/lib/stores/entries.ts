import { writable, derived } from 'svelte/store';
import { entryQueries } from '$lib/db';
import type { Entry } from '$lib/db';

// Helper functions for date manipulation
function getStartOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as start of week
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function getEndOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() + (7 - day) % 7;
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function getStartOfMonth(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
}

function getEndOfMonth(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
}

function getStartOfYear(date: Date): string {
  return new Date(date.getFullYear(), 0, 1).toISOString().split('T')[0];
}

function getEndOfYear(date: Date): string {
  return new Date(date.getFullYear(), 11, 31).toISOString().split('T')[0];
}

// Entries store
function createEntriesStore() {
  const { subscribe, set, update } = writable<Entry[]>([]);

  return {
    subscribe,

    async load(): Promise<void> {
      const entries = await entryQueries.getAll();
      set(entries);
    },

    async loadDateRange(startDate: string, endDate: string): Promise<Entry[]> {
      const entries = await entryQueries.getByDateRange(startDate, endDate);
      return entries;
    },

    async add(entry: Omit<Entry, 'id' | 'created_at'>): Promise<number> {
      const id = await entryQueries.create(entry);
      await this.load();
      return id;
    },

    async update(entry: Partial<Entry> & { id: number }): Promise<void> {
      await entryQueries.update(entry);
      await this.load();
    },

    async remove(id: number): Promise<void> {
      await entryQueries.delete(id);
      await this.load();
    },

    async getById(id: number): Promise<Entry | null> {
      return entryQueries.getById(id);
    },

    reset(): void {
      set([]);
    }
  };
}

export const entries = createEntriesStore();

// Stats store for aggregate data
interface Stats {
  weeklyHours: number;
  weeklyEarnings: number;
  monthlyHours: number;
  monthlyEarnings: number;
  yearlyHours: number;
  yearlyEarnings: number;
}

function createStatsStore() {
  const { subscribe, set } = writable<Stats>({
    weeklyHours: 0,
    weeklyEarnings: 0,
    monthlyHours: 0,
    monthlyEarnings: 0,
    yearlyHours: 0,
    yearlyEarnings: 0
  });

  return {
    subscribe,

    async load(): Promise<void> {
      const now = new Date();

      const [
        weeklyHours,
        weeklyEarnings,
        monthlyHours,
        monthlyEarnings,
        yearlyHours,
        yearlyEarnings
      ] = await Promise.all([
        entryQueries.getTotalHours(getStartOfWeek(now), getEndOfWeek(now)),
        entryQueries.getTotalEarnings(getStartOfWeek(now), getEndOfWeek(now)),
        entryQueries.getTotalHours(getStartOfMonth(now), getEndOfMonth(now)),
        entryQueries.getTotalEarnings(getStartOfMonth(now), getEndOfMonth(now)),
        entryQueries.getTotalHours(getStartOfYear(now), getEndOfYear(now)),
        entryQueries.getTotalEarnings(getStartOfYear(now), getEndOfYear(now))
      ]);

      set({
        weeklyHours,
        weeklyEarnings,
        monthlyHours,
        monthlyEarnings,
        yearlyHours,
        yearlyEarnings
      });
    },

    reset(): void {
      set({
        weeklyHours: 0,
        weeklyEarnings: 0,
        monthlyHours: 0,
        monthlyEarnings: 0,
        yearlyHours: 0,
        yearlyEarnings: 0
      });
    }
  };
}

export const stats = createStatsStore();

// Derived store for this week's entries
export const thisWeekEntries = derived(entries, ($entries) => {
  const now = new Date();
  const startOfWeek = getStartOfWeek(now);
  const endOfWeek = getEndOfWeek(now);

  return $entries.filter(entry => {
    return entry.date >= startOfWeek && entry.date <= endOfWeek;
  });
});

// Derived store for this month's entries
export const thisMonthEntries = derived(entries, ($entries) => {
  const now = new Date();
  const startOfMonth = getStartOfMonth(now);
  const endOfMonth = getEndOfMonth(now);

  return $entries.filter(entry => {
    return entry.date >= startOfMonth && entry.date <= endOfMonth;
  });
});

// Helper: Format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD'
  }).format(amount);
}

// Helper: Format hours
export function formatHours(hours: number): string {
  return `${hours.toFixed(1)} hrs`;
}
