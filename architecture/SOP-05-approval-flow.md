# SOP-05 — Approval Flow (Human-in-the-Loop Publishing)

**Layer:** N (Navigation) + T. Implemented by `bot.js` (persistent gateway) + `publish.js`.
**Golden Rule:** change this doc before changing approval/publish behavior.

## Goal
NOTHING posts to a public platform without an explicit ✅ from @iNFAMOUSII8. The bot delivers
each draft to Discord with ✅/❌ buttons, waits, and only publishes on approval.

## Why a persistent process
Button clicks arrive over the Discord gateway (websocket). Research runs fire-and-exit; the bot
must stay connected to receive interactions. This same process is what gets deployed in Step 8.

## Flow
1. `writer.js` creates drafts in `vg_drafts` (status 'pending_approval', delivered_at NULL).
2. Bot on `ready` → `deliverPendingDrafts()`: for each undelivered pending draft, post an embed
   (platform, title, body preview, voice-check status) + an ActionRow with two buttons:
   - ✅ custom_id `vg_approve:<draftId>`
   - ❌ custom_id `vg_reject:<draftId>`
   Then set `delivered_at = now()`. @ping the owner.
3. On `interactionCreate` (button):
   - **Authorization:** only `DISCORD_OWNER_ID` may act; others get an ephemeral "not authorized".
   - **✅ approve** → `publishDraft(id)` → on success edit the message (disable buttons, show the
     live URL); on error show the error, leave draft as pending for retry.
   - **❌ reject** → `rejectDraft(id)` → edit message (disable buttons, mark rejected).
4. Blocked drafts (refusal.blocked) are NEVER delivered with ✅ — they're flagged separately.

## Guards
- Reddit publishing is BLOCKED until its probe is green (deferred). publishDraft throws clearly.
- Paste-only platforms (twitter/linkedin/instagram) are status 'manual' — delivered as copy-paste
  text (future enhancement), never auto-published.
- Buttons are disabled after a terminal action to prevent double-publish.

## Verify
Run `bot.js`; it delivers a pending draft with buttons. Owner taps ✅ → post goes live + URL shown.
Tap ❌ → marked rejected, nothing posted.
