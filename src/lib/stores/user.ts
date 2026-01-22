import { writable, derived, get } from 'svelte/store';
import { userQueries, ratedJobQueries } from '$lib/db';
import type { User, RatedJob } from '$lib/db';

// User profile store
function createUserStore() {
  const { subscribe, set, update } = writable<User | null>(null);

  return {
    subscribe,

    async load(): Promise<void> {
      const user = await userQueries.get();
      set(user);
    },

    async create(userData: Omit<User, 'id' | 'created_at'>): Promise<number> {
      const id = await userQueries.create(userData);
      await this.load();
      return id;
    },

    async update(userData: Partial<User>): Promise<void> {
      const current = get({ subscribe });
      if (!current) return;

      await userQueries.update({ ...userData, id: current.id });
      await this.load();
    },

    reset(): void {
      set(null);
    }
  };
}

export const user = createUserStore();

// Rated jobs store
function createRatedJobsStore() {
  const { subscribe, set } = writable<RatedJob[]>([]);

  return {
    subscribe,

    async load(): Promise<void> {
      const jobs = await ratedJobQueries.getAll();
      set(jobs);
    },

    async add(job: Omit<RatedJob, 'id' | 'created_at'>): Promise<number> {
      const id = await ratedJobQueries.create(job);
      await this.load();
      return id;
    },

    async update(job: Partial<RatedJob> & { id: number }): Promise<void> {
      await ratedJobQueries.update(job);
      await this.load();
    },

    async remove(id: number): Promise<void> {
      await ratedJobQueries.delete(id);
      await this.load();
    },

    reset(): void {
      set([]);
    }
  };
}

export const ratedJobs = createRatedJobsStore();

// Derived store for user display name (First Last format)
export const userDisplayName = derived(user, ($user) => {
  if (!$user) return '';
  return `${$user.first_name} ${$user.last_name}`;
});

// Derived store to check if user has completed onboarding
export const hasCompletedOnboarding = derived(user, ($user) => {
  return $user !== null && $user.last_name && $user.man_number;
});

// Get hourly rate for a shift type
export function getHourlyRate(userData: User | null, shiftType: 'day' | 'afternoon' | 'graveyard'): number {
  if (!userData) return 0;

  switch (shiftType) {
    case 'day':
      return userData.day_rate || 0;
    case 'afternoon':
      return userData.afternoon_rate || 0;
    case 'graveyard':
      return userData.graveyard_rate || 0;
    default:
      return 0;
  }
}
