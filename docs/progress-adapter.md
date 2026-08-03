# Progress adapter notes

Face Reset currently stores check-ins, passport progress, scene stats, and the prototype leaderboard through the local progress adapter.

## Current provider

- Active provider: `local`
- Storage: browser `localStorage`
- Adapter entry: `src/utils/progressAdapter.js`
- Local implementation: `src/utils/localProgressAdapter.js`
- Future placeholder: `src/utils/viverseProgressAdapter.js`

## Stable screen calls

Screens should keep using these calls instead of calling storage directly:

- `loadHabitProgress()`
- `saveSessionResult(result)`
- `loadPassportProgress(habit)`
- `loadLeaderboardRows(habit)`
- `submitLeaderboardScore(result, habit)`
- `getPlayerIdentity(habit)`

## Debug helpers

When the URL has `?debug=1`, `ProgressDebugPanel` exposes:

- current device id
- today check-in status
- streak
- best score
- total sessions
- area progress
- recent history
- local leaderboard
- seed 7 test days
- clear today
- clear all local progress

These helpers should stay development-only and should not appear in normal user mode.
