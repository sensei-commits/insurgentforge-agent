# Deploying Vanguard to Railway

Vanguard is deployed as a **persistent service** on Railway (same infra as Helena). It runs 24/7,
checks for pending drafts on startup, listens for your ✅/❌ button clicks, and auto-runs research
via cron on schedule.

## Setup

### 1. Link the repo to Railway
Railway auto-detects Node.js projects. Point it at the `insurgentforge-agent/` directory (or the
root, if synced to a dedicated repo).

Railway will auto-detect:
- `package.json` ✅
- `Procfile` (sets `web: node execution/scheduler.js`) ✅
- Node.js ≥18 ✅

### 2. Configure environment variables in Railway console
Copy all values from your local `.env` into Railway's environment. Required vars:

```
DATABASE_URL                  Railway Postgres (shared with Helena)
DISCORD_TOKEN                 Bot token from Dev Portal
DISCORD_GUILD_ID              Server ID (InsurgentForge)
DISCORD_TRENDS_CHANNEL_ID     #trends channel ID
DISCORD_OWNER_ID              Your user ID (@iNFAMOUSII8)

DEEPSEEK_API_KEY              DeepSeek API key
GROQ_API_KEY                  Groq API key
GEMINI_API_KEY                (optional, 3rd fallback)

BLUESKY_HANDLE                e.g. insurgentsensei.bsky.social
BLUESKY_APP_PASSWORD          (app-specific password, not account password)

MASTODON_INSTANCE_URL         e.g. https://mastodon.social
MASTODON_ACCESS_TOKEN         Personal access token

DEVTO_API_KEY                 Dev.to API key

IRONCLAD_MIN_SOURCES          3 (tunable)
```

### 3. Deploy
Push to main (or the linked branch). Railway auto-builds and deploys.

## Behavior

On startup, Vanguard:
1. ✅ Connects to Discord gateway
2. ✅ Checks for pending drafts → delivers with ✅/❌ buttons
3. ✅ Sets up two cron jobs:
   - **DEEP**: Mondays 9:00 AM local (full research, 4 sources)
   - **LIGHT**: daily 9:00 AM local (quick skim)
4. ✅ Listens for button interactions (blocks non-owner clicks)

On cron fire:
- Research runs, posts Opportunity Report to #trends + @pings you
- Takes ~30-60s (depends on source latency)

On button click:
- ✅ Approve → publishes to Bluesky/Mastodon/Dev.to, shows live URL in Discord
- ❌ Reject → marks rejected, no post

## Monitoring

Check Railway's **Logs** tab to see:
- Startup messages (cron job times, gateway connect, pending deliveries)
- Cron fire times + research summaries
- Button clicks + publish URLs
- Errors (if any)

Example log flow:
```
[scheduler] 🚀 Vanguard starting up...
[scheduler] DEEP cron: Mondays at 9:00 AM (local)
[scheduler] LIGHT cron: daily at 9:00 AM (local)
[scheduler] 🐋 Vanguard online as InsurgentForge#8265
[scheduler] Listening for approvals on <#...>
[scheduler] Research cron jobs ready.
```

## Auto-restart on crash
Railway's default is to restart crashed services. You can tune this in the **Settings** tab:
- Restart policy: "on failure"
- Max restarts: unlimited or N (recommended: unlimited for 24/7 reliability)

## Debugging
If something fails:
- Check Railway logs first (cron job output, errors)
- Ensure all env vars are set (missing keys cause AI fallback, not crashes)
- Test locally with `npm start` — same code path
- Check DB for orphaned drafts or missed runs (query vg_runs, vg_drafts)

## Cost
- **$7/mo** Railway Postgres tier (shared with Helena, no extra cost)
- **$5/mo** Node.js execution tier (one persistent container for Vanguard + any future agents)
- Total incremental cost: **$0** if using existing Postgres tier

## Rollback
If a deploy breaks:
1. Railway → Deployments tab
2. Select the previous working deployment
3. Click "Redeploy"
4. Service restarts with the old code in ~30s
