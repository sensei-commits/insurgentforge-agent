# SOP-06 — Scheduling (Research Automation)

**Layer:** N. Implemented by `scheduler.js` (process-level cron via node-cron).
**Golden Rule:** change this doc before changing scheduler timing/behavior.

## Goal
Run research automatically on a schedule, freeing you from manual kicks. Two cadences:
- **DEEP**: weekly (Monday 9am local) → full research, 4 sources, high bar (3+ sources)
- **LIGHT**: daily 9am local → quick skim, only @pings if something breaks/urgent

## Design choice: in-process cron vs external
Vanguard is a single persistent process (the bot). Rather than external cron (Railway cron job,
GitHub Actions, etc — complexity, another account to manage), use `node-cron` to schedule
within the process. Same process, always on, always ready for your button clicks.

Trade-off: if the process crashes, cron stops. Mitigation: Railway auto-restarts on crash (configurable).

## Timing
- **DEEP run: Mondays 9:00 AM local time** → full research → posts to #trends + @ping
- **LIGHT run: daily 9:00 AM local time** → quick skim (shorter sources list, shorter timeframe)
  - If ironclad opportunities found → @ping + deliver to #trends
  - Otherwise → silent (no spam)

The scheduler logs all runs (start/end/summary) to console for Railway logs visibility.

## Implementation
- `scheduler.js` creates both cron jobs on startup
- Each job calls `research.js`'s `runDeepResearch()` with `{ runKind, minCorroboration }` tuning
- Results are the same (trends → Discord) — only the cadence/bar differs
- Graceful: on SIGINT/SIGTERM, cron jobs are cancelled before shutdown

## Verify
Run `scheduler.js`; it prints the next scheduled run times. Wait (or mock time) for a cron
fire; research runs, report goes to #trends.
