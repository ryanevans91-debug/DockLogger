# DockLog — Longshoreman Time Tracking App

## Overview
A mobile app for longshoremen to track work hours, earnings, stat holiday qualification, average hours for board moves, and pensionable year progress. Replacing the outdated "My TimeBook" app with a modern, clean UI.

Target users: Longshoremen at ILWU Local 502 (Surrey/Delta BC, Canada), eventually expandable to other locals/ports.

## Tech Stack
- **Svelte + SvelteKit** — UI framework
- **Capacitor** — Native iOS/Android wrapper
- **SQLite** — Local database (offline-first)
- **Tailwind CSS** — Styling

## Key Domain Concepts

### Shifts
- **Day:** 8am-4:30pm (8 hrs)
- **Afternoon:** 4:30pm-1am (8 hrs)  
- **Graveyard:** 1am-8am (6.5 hrs)

### Jobs
- **Rated Job:** User's certified jobs (Multi-Trailer, Gearman, Reachstacker, etc.) configured in profile with pay rules (extra hour, big hour 1.5×)
- **Hall Job:** Dispatched job from the hall — user types in job title, can note pay specifics

### Pay Calculations
- Base: hours × shift rate
- Some rated jobs add +1 extra hour or +1 "big hour" (1.5× rate)
- Each user enters their own hourly rates (varies by seniority, etc.)

### Stat Holidays (BC)
- Must work 15 days within 30-day window before stat to qualify for full stat pay
- Stat pay = 8 hrs × day shift rate
- Partial qualification = prorated (e.g., 10/15 days = 66.7% of stat pay)

### Average Hours (Board Moves)
- Must hit average hours (e.g., 600 hrs) in qualifying period to be eligible for board move (promotion)
- Users need to track progress and pace toward this goal

### Pensionable Year
- Annual earnings target for pension credit
- User sets their own target amount

### Name Format
- Longshoremen typically go by "Last name, First initial" (e.g., "Morrison, R")

## MVP Screens (6 total)

### 1. Onboarding
- Name (last, first initial)
- Man number
- Current board
- Hourly rates (day, afternoon, graveyard with times shown)
- Add rated jobs (name only — pay rules configured when adding)

### 2. Dashboard (Home)
- Welcome header with name, man #, board
- **Average Hours Box:** Progress bar, X/600 hrs, pace indicator, days remaining
- **Stat Holiday Box:** Next stat, X/15 days, $X/$Y earned, progress bar
- **Quick Stats:** Hours & $ this week, this month, YTD, career total

### 3. Calendar
- Monthly grid view
- Color coding:
  - Solid blue: worked days (outside stat window)
  - Light blue: worked days counting toward stat
  - Green border: actual stat holiday
- **"This Week" section:** 7 square cards showing current week's entries (Job → Date → $$$)

### 4. Entry Form
- Date picker
- Shift type toggle: Day / Afternoon / Graveyard
- Job selection: Rated (dropdown) OR Hall (text input)
- Hours (defaults by shift type, editable)
- Location / Ship (optional)
- Notes field (smart notes for tips, locations, pay details)
- **Live earnings preview**
- Save button → "$$$ earned today! 💰"

### 5. Summary
- Period filter: Week / Month / Quarter / Year
- Total hours + earnings card
- **Pensionable Year tracker:** Progress bar toward annual goal
- **Calendar-style entry grid:** Full month view with mini cards (Job → Date → $$$)

### 6. Settings
- Profile info (name, man #, board)
- Hourly rates with shift times
- Rated jobs list (add/edit/remove)
- Average hours target
- Pensionable year target
- Export to CSV

## Database Schema

```sql
CREATE TABLE user (
  id INTEGER PRIMARY KEY,
  last_name TEXT NOT NULL,
  first_initial TEXT NOT NULL,
  man_number TEXT NOT NULL,
  current_board TEXT,
  day_rate REAL,
  afternoon_rate REAL,
  graveyard_rate REAL,
  average_hours_target INTEGER DEFAULT 600,
  pension_target REAL,
  career_hours REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rated_jobs (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  has_extra_hour BOOLEAN DEFAULT FALSE,
  is_big_hour BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE entries (
  id INTEGER PRIMARY KEY,
  date DATE NOT NULL,
  shift_type TEXT NOT NULL,
  job_type TEXT NOT NULL,
  rated_job_id INTEGER,
  hall_job_name TEXT,
  hours REAL NOT NULL,
  location TEXT,
  ship TEXT,
  notes TEXT,
  earnings REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rated_job_id) REFERENCES rated_jobs(id)
);

CREATE INDEX idx_entries_date ON entries(date);
```

## Folder Structure

```
src/
├── lib/
│   ├── components/      # Card, ProgressBar, ShiftPicker, JobSelector, CalendarGrid, WeekStrip, StatBox, NavBar
│   ├── stores/          # user.js, entries.js, settings.js
│   ├── db/              # SQLite setup, schema, queries
│   ├── utils/           # earnings.js, dates.js, stats.js
│   └── constants/       # shifts.js, statHolidays.js
├── routes/
│   ├── +layout.svelte   # App shell with NavBar
│   ├── +page.svelte     # Dashboard
│   ├── calendar/+page.svelte
│   ├── entry/+page.svelte
│   ├── entry/[id]/+page.svelte
│   ├── summary/+page.svelte
│   ├── settings/+page.svelte
│   └── onboarding/+page.svelte
```

## Build Order

### Phase 1: Foundation
1. Project setup (SvelteKit + Capacitor + Tailwind)
2. SQLite database connection
3. Basic stores (user, entries)
4. NavBar + layout shell

### Phase 2: Core Screens
5. Onboarding flow
6. Entry form
7. Dashboard with stat boxes
8. Calendar view

### Phase 3: Polish
9. Summary screen
10. Settings screen
11. Earnings calculations
12. Stat holiday logic

### Phase 4: Ship
13. App icon + splash screen
14. Test on devices
15. Build & submit

## Design Notes
- Modern, clean UI (not 2014 vibes)
- Blue primary color
- Green for money/earnings
- Cards with subtle shadows and borders
- Progress bars for goals
- Dopamine hit: show earnings prominently on every save
