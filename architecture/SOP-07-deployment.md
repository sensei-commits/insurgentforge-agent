# SOP-07 — Deployment & Monitoring (Phase T)

**Layer:** Operations. Executed via Railway CLI / Web Console + local verification.
**Golden Rule:** change this doc before changing deployment/monitoring procedures.

## Goal
Deploy Vanguard to Railway as a persistent 24/7 service. Set up cron scheduling, monitoring,
and a self-healing runbook for common issues.

## Pre-deployment checklist
- [ ] All `.env` variables populated (DATABASE_URL, DISCORD_TOKEN, API keys, etc.)
- [ ] `.env.example` up-to-date with template
- [ ] `package.json` start script points to `scheduler.js`
- [ ] `Procfile` exists and is correct
- [ ] Local `npm start` works (tested for 10s, graceful shutdown via Ctrl+C)
- [ ] All tests pass (`npm run test` or run test-*.js individually)
- [ ] Git repo ready (if deploying from GitHub)

## Deployment steps
1. **Link to Railway** (create service, point at `insurgentforge-agent/` dir)
2. **Set environment variables** (copy from `.env` into Railway console)
3. **Deploy** (push to linked branch, or use Railway CLI)
4. **Verify startup** (check logs for `[scheduler]` messages)
5. **Test cron** (manually trigger research, or wait for scheduled time)
6. **Monitor first 24h** (watch logs for errors, button clicks, cron fires)

## Monitoring
- **Railway Logs tab:** filter for `[scheduler]` to see Vanguard output
- **Discord #trends:** watch for Opportunity Reports + pending draft messages
- **Button clicks:** check logs for "published draft" or "rejected draft" messages
- **Cron fires:** watch for "DEEP research run started" or "LIGHT research run started"

## Common issues & fixes
| Issue | Root cause | Fix |
|---|---|---|
| "Vanguard online" but doesn't deliver drafts | Pending drafts exist but bot is slow | Wait 10s, then manually ping the channel (bot delivers on startup) |
| "Not connecting to Discord" | Bad DISCORD_TOKEN or perms | Check var is exact, check bot has View Channel + Send Message in #trends |
| "AI key missing" error | DEEPSEEK_API_KEY or GROQ_API_KEY not set | Set at least one (Groq free tier OK) |
| Cron never fires at 9am | Node-cron working but timezone issue | Check Railway logs for any [scheduler] messages; verify local machine timezone is correct |
| Button click doesn't publish | Draft is blocked by refusal gate | Check logs for refusal reason; click ❌ to reject instead, then create new draft |
| Research run slow/timeout | Source API latency (HN, GH, etc.) | Normal, can take 30-60s; check logs for "started" → "complete" |

## Self-healing
- **Auto-restart on crash:** Railway default is on. Service restarts in ~10s if it crashes.
- **Graceful shutdown:** Process responds to SIGINT/SIGTERM, cancels crons, closes DB.
- **Stale API keys:** If a key expires, AI routing falls back to next provider. Logs show which.
  Non-blocking — service keeps running.
- **Button timeout:** If button response takes >3s, Discord shows "This interaction failed".
  Retry by clicking again (idempotent — same logic runs).

## Rollback
If a deploy breaks:
1. Railway → **Deployments** tab
2. Find the last working deployment
3. Click **Redeploy**
4. Service restarts with old code (~30s)

## Monitoring dashboard (future)
Suggested additions (not in Phase T scope):
- Grafana dashboard: track research run count/duration, publish success rate, button click rate
- Alerting: PagerDuty/Slack if 3+ deployments fail in a row
- Metrics API: expose `/metrics` endpoint for Prometheus scraping

## Cost tracking
- Railway charges by compute (node process) + storage (Postgres)
- Vanguard uses ~50MB RAM (node process)
- Research runs use ~200MB temporary (cleaned up after)
- First-month free, then ~$5/month for the node container (shared tier)
- Postgres already exists (shared with Helena)

## Logs retention
- Railway keeps logs for 7 days (free tier)
- For longer retention, export to a log service (Datadog, LogRocket, etc.)
- Or pipe to PostgreSQL (create a logging table vg_logs)
