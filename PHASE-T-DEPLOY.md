# Phase T — TRIGGER: Deployment Guide

Deploy Vanguard to Railway and go live with automated research + approval-based publishing.

---

## Scenario A: GitHub Repo (Recommended)

If `insurgentforge-agent/` is already in a GitHub repo:

### 1. Push all Phase A code to GitHub
```bash
cd insurgentforge-agent
git add -A
git commit -m "Phase A: Vanguard architecture complete (research + writer + bot + scheduler)"
git push origin main
```

### 2. Link repo to Railway
1. Go to https://railway.app
2. Click **New** → **GitHub**
3. Choose your GitHub repo (or create one if needed)
4. Select the branch (usually `main`)
5. Railway auto-detects Node.js project

### 3. Set environment variables (Railway Console)
1. Go to **Variables** tab
2. Add each key from your local `.env`:

```
DATABASE_URL=<postgres-url>
DISCORD_TOKEN=<bot-token>
DISCORD_GUILD_ID=<server-id>
DISCORD_TRENDS_CHANNEL_ID=<channel-id>
DISCORD_OWNER_ID=<your-user-id>

DEEPSEEK_API_KEY=<key>
GROQ_API_KEY=<key>
GEMINI_API_KEY=<key> (optional)

BLUESKY_HANDLE=<handle.bsky.social>
BLUESKY_APP_PASSWORD=<password>

MASTODON_INSTANCE_URL=https://mastodon.social
MASTODON_ACCESS_TOKEN=<token>

DEVTO_API_KEY=<key>

IRONCLAD_MIN_SOURCES=3
```

### 4. Deploy
Railway auto-deploys on push. Or trigger manually:
1. Railway → **Deploy** tab
2. Click **Redeploy**

Expected time: **2-3 minutes**

---

## Scenario B: No GitHub (Local Upload via Railway CLI)

If code is just local, use Railway CLI:

### 1. Install Railway CLI
```bash
npm install -g @railway/cli
```

Or download from https://railway.app/docs/cli/install

### 2. Login to Railway
```bash
railway login
```
Opens a browser → authorize → returns to terminal

### 3. Create a new Railway project
```bash
cd insurgentforge-agent
railway init
```
Follow prompts, create a new project called "vanguard"

### 4. Set environment variables
```bash
railway variables set DATABASE_URL=<postgres-url>
railway variables set DISCORD_TOKEN=<token>
# ... repeat for all vars from your .env
```

Or use the Railway Web Console (paste them all at once).

### 5. Deploy
```bash
railway up
```
Uploads code + deploys. Wait for "Deployment complete" message.

---

## Verify Deployment

### 1. Check service is online
Railway → **Logs** tab. Wait 10-15s, you should see:

```
[scheduler] 🚀 Vanguard starting up...
[scheduler] DEEP cron: Mondays at 9:00 AM (local)
[scheduler] LIGHT cron: daily at 9:00 AM (local)
[scheduler] 🐋 Vanguard online as InsurgentForge#8265
[scheduler] Listening for approvals on <#CHANNEL_ID>
[scheduler] Research cron jobs ready.
```

✅ **Service is live.**

### 2. Check Discord #trends for pending drafts
Go to **#trends** in your Discord server. If you have pending drafts from earlier testing:
- You should see a message with the draft + ✅/❌ buttons (delivered by the bot on startup)
- Click ✅ on one → it publishes live + shows URL

### 3. Manually test research
Run this locally (or via Railway console, if you want):
```bash
node execution/research.js
```

This fires a **DEEP research** immediately (doesn't wait for cron). Should complete in 30-60s.
You'll see an Opportunity Report in #trends with ironclad findings.

---

## Scheduled Research (Now Live)

The cron jobs are active:
- **DEEP:** Every Monday at 9:00 AM (your local/Railway timezone)
- **LIGHT:** Every day at 9:00 AM

Watch **Railway Logs** for the fire times. You'll see:
```
[scheduler] 🔍 DEEP research run started (weekly)
[scheduler] ✅ deep run complete.
```

---

## Test the Full Flow

1. **Wait for (or manually trigger) a research run**
   - #trends gets an Opportunity Report with ⭐ ironclad opportunities
   
2. **Pick an opportunity → generate a draft**
   ```bash
   node execution/make-draft.js bluesky
   ```
   (Locally, or you can skip this — the writer will auto-generate if you manually request)
   
3. **Restart the bot (or wait for startup)**
   - Railway → **Redeploy** (or just wait, bot delivers pending on startup)
   
4. **#trends gets a draft message** with ✅/❌ buttons

5. **Click ✅ Approve & Publish**
   - Draft publishes live to Bluesky/Mastodon/Dev.to
   - Message updates with the live URL

6. **Done.** You just published a post via Vanguard. 🎉

---

## Troubleshooting

### Service won't start
**Symptom:** Logs show errors immediately, service crashes.

**Check:**
1. All env vars set (Railway → **Variables**)
2. DATABASE_URL is correct and accessible
3. DISCORD_TOKEN is valid (check Dev Portal)
4. At least DEEPSEEK_API_KEY OR GROQ_API_KEY is set

**Fix:** Add the missing var, redeploy.

### Cron never fires
**Symptom:** No research runs at 9am, logs are silent at that time.

**Reason:** cron might be waiting for the next occurrence, or timezone mismatch.

**Check:**
1. Railway logs around 9am local time
2. Is the service actually running? (should see `[scheduler] ready` in logs)
3. Timezone: Railway might be on UTC. Check Railway → **Settings** → Timezone

**Fix:** Manually trigger:
```bash
node execution/research.js
```
(Run locally; if it works, cron infrastructure is OK — probably just a timezone issue.)

### Bot can't publish
**Symptom:** Click ✅ → error message in Discord.

**Check logs for:**
- `action error on <draftId>: <message>`

**Possible causes:**
- Bluesky/Mastodon/Dev.to API down (check their status pages)
- Invalid auth credentials (BLUESKY_APP_PASSWORD wrong, etc.)
- Draft is blocked by refusal gate (try ❌ reject instead)

**Fix:** 
1. Re-check API credentials in Railway → Variables
2. If API is down, wait and retry
3. Create a new draft and try again

### Button click doesn't respond
**Symptom:** Click ✅/❌ → "This interaction failed" (after 3s)

**Reason:** Publishing is slow (AI routes slow, APIs slow) and Discord times out.

**Fix:** Retry. The logic is idempotent — clicking again is safe.

---

## Monitoring Plan (First 24 Hours)

**Hour 1:**
- [ ] Check startup logs (should see "online" message)
- [ ] Check #trends (should deliver any pending drafts)
- [ ] Manually test research.js
- [ ] Test a draft approval flow (✅ button)

**Hours 2-24:**
- [ ] Monitor logs for any errors (filter for `error`, `❌`)
- [ ] Watch #trends for research runs (if it's Monday 9am or after you manually trigger)
- [ ] Test button interactions (✅/❌) a few times

**Day 2+:**
- [ ] Verify cron fired (check logs for `[scheduler] DEEP` or `[scheduler] LIGHT`)
- [ ] Check quality of published posts (on your Bluesky/Mastodon/Dev.to accounts)
- [ ] Fine-tune voice profile if needed (tweak prompts in writer.js)

---

## Costs

**Monthly:** ~$5-7 (Railway node container)  
**Included:** Database (shared with Helena, no extra cost)  
**No additional:** API calls, hosting, infrastructure

---

## Next Steps (Phase S — STYLIZE, Future)

After 24h of live monitoring:
1. **Fine-tune voice.** Review published posts. If any feel off, adjust VOICE in writer.js.
2. **Collect samples.** Save approved posts (they're on your accounts). Use them to refine the prompt.
3. **Enable Reddit** (optional). Once Reddit account is 2+ weeks old, fill REDDIT_* vars.
4. **Scale sources** (optional). Add more collectors (Twitch, Discord forums, etc.).

---

## Done?

🐋 **Vanguard is live. You have a 24/7 research agent posting to your platforms with your approval.**

**Questions? Check RAILWAY.md or SOP-07-deployment.md for deeper dives.**
