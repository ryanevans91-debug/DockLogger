# DockLogger - Development Progress

## Phase 1: Foundation ✅ COMPLETE
- [x] SvelteKit project setup with TypeScript
- [x] Tailwind CSS v4 configuration
- [x] Capacitor integration (Android + iOS)
- [x] SQLite database setup (@capacitor-community/sqlite + sql.js)
- [x] Database schema (user, rated_jobs, entries tables)
- [x] Database queries module
- [x] User store with SQLite sync
- [x] Entries store with stats calculations
- [x] Bottom NavBar component
- [x] App layout shell

## Phase 2: Core Screens ✅ COMPLETE
- [x] Onboarding flow (/onboarding)
- [x] Entry form with live earnings preview (/entry)
- [x] Entry edit page (/entry/[id])
- [x] Dashboard with stat boxes (/)
- [x] Calendar view (/calendar)
- [x] Summary screen (/summary)
- [x] Settings screen (/settings)

## Phase 3: Polish ✅ COMPLETE
- [x] Earnings calculations (base rate + extra hour + big hour multiplier)
- [x] Stat holiday logic (BC holidays, qualifying window, pay calculation)
- [x] Average hours tracking for board moves
- [x] Pensionable year progress tracking
- [x] Success animation on entry save

## Phase 4: Ship 🚧 IN PROGRESS
- [x] App icon design and generation
- [x] Splash screen design and generation
- [x] Configure resources for iOS and Android
- [ ] Test development build on device/emulator
- [ ] Production build configuration
- [ ] App store metadata preparation

## Future Enhancements (Backlog)
- [ ] CSV export functionality (currently shows "coming soon")
- [ ] Day detail modal when clicking calendar day with multiple entries
- [ ] Edit rated jobs (currently only add/delete)
- [ ] Push notifications for stat holiday reminders
- [ ] Data backup/restore
- [ ] Dark mode support
- [ ] Multiple user profiles (for different locals/ports)

## Known Issues
- None currently tracked

## Tech Stack
- **Framework**: SvelteKit 2 with Svelte 5 (runes)
- **Native**: Capacitor 6
- **Database**: @capacitor-community/sqlite + sql.js (web fallback)
- **Styling**: Tailwind CSS v4
- **Language**: TypeScript

## File Structure
```
src/
├── lib/
│   ├── components/     # NavBar
│   ├── constants/      # statHolidays
│   ├── db/            # database, schema, queries
│   ├── stores/        # user, entries
│   └── utils/         # stats calculations
├── routes/
│   ├── +layout.svelte  # App shell
│   ├── +page.svelte    # Dashboard
│   ├── calendar/       # Calendar view
│   ├── entry/          # Entry form + edit
│   ├── onboarding/     # First-time setup
│   ├── settings/       # User settings
│   └── summary/        # Period summaries
```

## Build Commands
```bash
npm run dev          # Development server
npm run build        # Production build
npx cap sync         # Sync with native platforms
npx cap open android # Open in Android Studio
npx cap open ios     # Open in Xcode (Mac only)
```
