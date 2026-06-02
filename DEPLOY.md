# Vanguard Deployment Checklist

Get Vanguard live on Railway in ~5 minutes.

## Pre-flight

**Verify locally:**
```bash
npm start
```
Wait 3-5 seconds. You should see:
```
[scheduler] 🚀 Vanguard starting up...
[scheduler] DEEP cron: Mondays at 9:00 AM (local)
[scheduler] LIGHT cron: daily at 9:00 AM (local)
[scheduler] 🐋 Vanguard online as InsurgentForge#8265
[scheduler] Listening for approvals on <#CHANNEL_ID>
[scheduler] Research cron jobs ready.
```

Press **Ctrl+C** to shut down (graceful). ✅

---

## Railway Deployment

### 1. Go to Railway dashboard
https://railway.app

### 2. Create a new service (or link existing repo)
If this is a new project on Railway:
- Click **New**
- Choose **GitHub** (if repo is on GitHub) OR **Empty Service** (for a test)
- Link the repo (or just the `insurgentforge-agent/` folder)
- Railway auto-detects Node.js

If extending existing Helena project:
- Add a service to the same project
- Point at `insurgentforge-agent/`

### 3. Set environment variables
In the Railway console, go to **Variables**. Copy these from your local `.env`:

```
DATABASE_URL
DISCORD_TOKEN
DISCORD_GUILD_ID
DISCORD_TRENDS_CHANNEL_ID
DISCORD_OWNER_ID
DEEPSEEK_API_KEY
GROQ_API_KEY
GEMINI_API_KEY (optional)
BLUESKY_HANDLE
BLUESKY_APP_PASSWORD
MASTODON_INSTANCE_URL
MASTODON_ACCESS_TOKEN
DEVTO_API_KEY
IRONCLAD_MIN_SOURCES
```

### 4. Deploy
Push to main (or the linked branch). Railway auto-builds and deploys.

Expected build time: ~2 min
Startup time: ~10 sec

### 5. Monitor startup
In Railway → **Logs**, you should see:
```
[scheduler] 🚀 Vanguard starting up...
[scheduler] DEEP cron: Mondays at 9:00 AM (local)
[scheduler] LIGHT cron: daily at 9:00 AM (local)
[scheduler] 🐋 Vanguard online as InsurgentForge#8265
[scheduler] Listening for approvals on <#TRENDS_CHANNEL_ID>
[scheduler] Research cron jobs ready.
```

✅ **Live.**

---

## Test It

### Manually trigger a research run (local, immediate)
```bash
node execution/research.js
```

This fires a **DEEP research** immediately (not waiting for Monday 9am cron). Posts to #trends.

### Check pending drafts
In Discord, go to **#trends**. You should see:
- Recent Opportunity Report (if you just ran research)
- Any pending draft messages with ✅/❌ buttons

Click ✅ on a draft → it posts live + URL appears in Discord.

---

## Monitoring

**Check logs regularly:**
- Railway → **Logs** tab
- Search for `[scheduler]` to filter Vanguard logs
- Watch for cron fires, errors, button clicks

**Cron schedule (once live):**
- **DEEP:** Mondays 9:00 AM (your local timezone)
- **LIGHT:** daily 9:00 AM (your local timezone)

---

## Troubleshooting

**"Not connecting to Discord"**
- Check DISCORD_TOKEN in Railway → Variables (copy it exactly)
- Restart the service (Railway → **Deploy** tab, click **Redeploy**)

**"Research fails with 'AI key missing'"**
- Check DEEPSEEK_API_KEY and GROQ_API_KEY are set
- At least one must be present (Groq is free/required)

**"No cron fire at 9am"**
- Node-cron uses LOCAL timezone
- Check Railway logs for `[scheduler]` entries (they log all runs)
- If no fire: cron times are correct, but Railway logs should confirm

**"Published a draft to the wrong platform"**
- Vanguard can only publish to Bluesky/Mastodon/Dev.to automatically
- Twitter/LinkedIn/Instagram are paste-only (draft status='manual', you copy/paste)

**Want to rollback?**
- Railway → **Deployments** tab
- Select the previous working deployment
- Click **Redeploy**
- Service restarts in ~30s with old code

---

## Cost

Already covered by existing Railway tier (shared with Helena). **Incremental: $0.**

---

## Next Steps After Deploy

1. **Monitor the first week.** Watch logs for any errors, check cron fires.
2. **Fine-tune if needed.** If posts feel off-voice, tweak the VOICE profile in writer.js.
3. **Enable Reddit** (optional, Phase T). Once Reddit account is warm (2+ weeks old), fill REDDIT_* vars + run probe:reddit.
4. **Scale sources** (optional). Add more collectors (Twitch, Discord community forums, etc.) as needed.

---

**Done.** Vanguard is live. 🐋⚔️
