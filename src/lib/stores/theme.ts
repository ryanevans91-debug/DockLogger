import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type ThemeMode = 'light' | 'dark';
export type ColorTheme = 'blue' | 'white' | 'red' | 'green' | 'yellow' | 'orange' | 'purple' | 'pink' | 'grey' | 'brown';

interface ThemeState {
  mode: ThemeMode;
  colorTheme: ColorTheme;
}

const STORAGE_KEY = 'docklogger-theme';

function getInitialTheme(): ThemeState {
  if (browser) {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Invalid JSON, use defaults
      }
    }
  }
  return { mode: 'light', colorTheme: 'blue' };
}

function createThemeStore() {
  const { subscribe, set, update } = writable<ThemeState>(getInitialTheme());

  return {
    subscribe,

    setMode(mode: ThemeMode) {
      update(state => {
        const newState = { ...state, mode };
        if (browser) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
          applyTheme(newState);
        }
        return newState;
      });
    },

    setColorTheme(colorTheme: ColorTheme) {
      update(state => {
        const newState = { ...state, colorTheme };
        if (browser) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
          applyTheme(newState);
        }
        return newState;
      });
    },

    init() {
      if (browser) {
        const state = getInitialTheme();
        set(state);
        applyTheme(state);

        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', () => {
          const currentState = getInitialTheme();
          if (currentState.mode === 'system') {
            applyTheme(currentState);
          }
        });
      }
    }
  };
}

function applyTheme(state: ThemeState) {
  if (!browser) return;

  const root = document.documentElement;

  // Apply dark/light mode
  const isDark = state.mode === 'dark';
  root.classList.toggle('dark', isDark);

  // Apply color theme
  root.setAttribute('data-theme', state.colorTheme);
}

export const theme = createThemeStore();

// Color theme definitions - 10 accent colors
export const colorThemes: Record<ColorTheme, { name: string; primary: string; primaryLight: string }> = {
  blue: { name: 'Blue', primary: '#2563eb', primaryLight: '#dbeafe' },
  white: { name: 'White', primary: '#6b7280', primaryLight: '#f3f4f6' },
  red: { name: 'Red', primary: '#dc2626', primaryLight: '#fee2e2' },
  green: { name: 'Green', primary: '#16a34a', primaryLight: '#dcfce7' },
  yellow: { name: 'Yellow', primary: '#eab308', primaryLight: '#fef9c3' },
  orange: { name: 'Orange', primary: '#ea580c', primaryLight: '#ffedd5' },
  purple: { name: 'Purple', primary: '#9333ea', primaryLight: '#f3e8ff' },
  pink: { name: 'Pink', primary: '#db2777', primaryLight: '#fce7f3' },
  grey: { name: 'Grey', primary: '#6b7280', primaryLight: '#f3f4f6' },
  brown: { name: 'Brown', primary: '#92400e', primaryLight: '#fef3c7' }
};
