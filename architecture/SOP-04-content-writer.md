# SOP-04 — Content Writer + Voice Check + Refusal Gate

**Layer:** A. Implemented by `writer.js`. Uses `ai.js` (think/quick).
**Golden Rule:** change this doc before changing writer logic.

## Goal
Turn an opportunity (vg_trends row) into a platform-tailored post draft that sounds like
@iNFAMOUSII8, gives real cost-cutting value, and passes hard safety + voice gates BEFORE it ever
reaches the owner for approval.

## Pipeline (per draft)
1. **REFUSAL GATE (first, cheap, deterministic + AI).** If the topic trips a banned theme →
   `refusal.blocked = true`, store with status='rejected', flag owner with reason. NO post generated.
2. **GENERATE.** `think()` writes the post using the VOICE PROFILE + platform spec + the trend's
   evidence and cost-saving angle.
3. **VOICE CHECK.** Scan for AI cliches (deterministic banlist) + dedup vs prior drafts.
   If cliches found → ONE automatic rewrite pass. Record findings in `voice_check`.
4. **STORE.** Insert into `vg_drafts` (status 'pending_approval' for auto-post platforms;
   'manual' for paste-only platforms: twitter/linkedin/instagram).

## Refusal triggers (hard bans — from CLAUDE.md)
politics · drama/controversy · religion · scam/spam. If unsure → block + flag (never auto-pass).
Deterministic keyword pre-check, then an AI yes/no via `quick()` for grey areas.

## VOICE PROFILE (from CLAUDE.md, condensed for the prompt)
- IS @iNFAMOUSII8 — a real builder talking to builders. Casual peer-to-peer, first person.
- Humorous, friendly, pro when it counts, genuinely excited about bots/AI.
- A few well-placed emoji OK (none-to-light on Reddit). No emoji-stuffing.
- Cost-cutting framing: people overpay for bloated bots → InsurgentForge builds leaner+cheaper.
  NEVER "learn to build". NEVER trash competitors ("leaner/cheaper way", not "X is garbage").
- VARY the closer every time (question / tip / "what are you building?" / resource / none).
  Motto "Build. Forge. Empower." used RARELY, never as a default sign-off.

## AI cliche banlist (auto-flag + rewrite)
dive in, game-changer/game changer, unlock, elevate, in today's fast-paced world, in conclusion,
leverage (as filler), supercharge, revolutionize, seamless, "look no further", "the world of",
"say goodbye to", "imagine a", "in the realm of", robotic intros/outros, emoji-stuffing.

## Platform specs
| platform | title? | max chars | shape |
|---|---|---|---|
| bluesky | no | 300 | punchy, 1-2 lines, link optional |
| mastodon | no | 500 | punchy, dev-friendly |
| devto | yes | ~long | markdown article, technical, evergreen |
| reddit | yes | ~long | value-first, no promo until warmed up |
| twitter | no | 280 | punchy hook (DRAFT → paste) |
| linkedin | no | ~700 | polished-warm, B2B credibility (DRAFT → paste) |
| instagram | no | ~500 | visual caption (DRAFT → paste) |

## Dedup rule
Before storing, compare the new body against the last N drafts (same platform) by normalized word
overlap. If >0.6 overlap → `voice_check.duplicate_of = <draft_id>` and flag for owner review
(never silently publish a near-repeat).
