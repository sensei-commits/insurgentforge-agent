# SOP-03 — Research Pipeline (Opportunity Hunting)

**Layer:** A. Implemented by `sources/*.js` collectors + `score.js` + `research.js` (Navigation).
**Golden Rule:** change this doc before changing the pipeline.

## Goal
Find WHERE cost-cutting opportunity & demand are in the Discord-bot niche, with IRONCLAD
evidence. Output ranked opportunities for the #trends digest. No guessing — evidence or it didn't
happen.

## The 6 steps (deep run)
1. **COLLECT** — each `sources/<name>.js` pulls raw items and returns a normalized signal array.
2. **EXTRACT** — classify each signal into one of: `overpay | pain | demand | trend`.
   (collectors give a best-guess type; AI `quick()` can refine.)
3. **CORROBORATE** — cluster signals describing the same thing across sources → a fingerprint.
4. **SCORE** — confidence from EVIDENCE strength: corroboration_count, source diversity, metrics.
   A cluster with `corroboration_count >= 2` → `status='ironclad'`; else `'watch'`.
5. **EVIDENCE PACK** — persist `vg_trends` (the opportunity) + its backing `vg_signals` (links).
6. **DELIVER** — `think()` writes a brand-voice summary + cost_saving_angle → post to #trends, @ping.

## Normalized signal shape (every collector returns this)
```js
{
  source: 'github',            // origin
  url: 'https://...',          // REQUIRED direct link (no link = no ironclad)
  signal_type: 'trend',        // overpay | pain | demand | trend (best-guess)
  quote_or_metric: '420★, created 2026-05-20', // hard evidence
  title: 'short label',        // for fingerprinting/clustering
  raw: { ... }                 // original payload
}
```

## Source roster (priority)
| source | what it reveals | key? |
|---|---|---|
| github | repos builders adopt; FREE alternatives to paid bots (overpay signal) | optional GITHUB_TOKEN raises rate limit |
| hackernews | launches, pricing gripes | none |
| reddit (read) | r/Discord_Bots gripes about overpriced bots — FREE public JSON API (no auth for read) | none |
| google_trends | search demand curves | none |
| youtube | tutorial/demand volume | YT key |

## Determinism rules
- Collectors NEVER write to DB. They return arrays. (Pure, testable.)
- Only `score.js` writes `vg_trends`/`vg_signals`, inside a transaction.
- Dedup: `vg_trends.fingerprint` UNIQUE. Re-seeing a trend bumps `last_seen` + corroboration, never dups.
- 2-source rule is enforced in `score.js`, surfaced via `vg_runs.trends_skipped_single_source`.

## Relevance + Safety Filter (score.js, strict — user choice 2026-06-02)
Deterministic DENYLIST drops sketchy/off-brand signals BEFORE scoring. A signal is dropped if its
text (title+description+url) matches any banned pattern:
- ToS-violating: selfbot, self-bot, token grabber/logger, nuker, raid, crash, ddos, doxx
- Cheating: exam/quiz/test auto-answer, edgenuity, "homework bot"
- Financial spam: trading signal, crypto pump, airdrop, "free nitro", pump-and-dump
- Spam: a discord.gg invite stuffed into the repo name/title
Report keeps a `dropped` count + the dropped titles (transparency). Deterministic denylist first;
an AI relevance pass (`quick()`) can be layered later for grey-area calls.

## Scoring (score.js)
- fingerprint = CONCEPT slug (not title slug) → enables cross-source clustering. Two tiers:
  (1) cost/intent concepts (overpay:alternative, pain:not-working, demand:custom-build, etc.) — span
      all sources; Google Trends supplies `fingerprintHint` directly. GitHub/HN matched via text.
  (2) feature categories (feat:music, feat:moderation, etc.) for domain-specific clustering.
  Fallback: signal_type + first non-stopword. Redesigned 2026-06-02 when v1 (name-based) failed
  to cluster across sources (GitHub kw:adgjmptw2 ≠ Google Trends kw:google).
- **corroboration_count = number of DISTINCT SOURCES backing the fingerprint** (NOT raw item count).
  This is the fix for the original "2 INDEPENDENT sources" rule — 4 GitHub repos on the same topic
  = 1 source = still 'watch'. Prevents false 'ironclad'.
- status = 'ironclad' iff distinct sources >= **IRONCLAD_MIN_SOURCES** (env, default **3**), else 'watch'.
  Tunable in .env. With only 2 collectors live (GitHub+HN), NOTHING is ironclad at threshold 3 yet —
  ironclad lights up once a 3rd collector (Reddit-read / Google Trends / YouTube) corroborates.
  Raised from 2→3 on 2026-06-02 (user: "2 sources is too low"). This is correct, not a bug.
- confidence (0..1) = 0.4·(sources−1) + 0.4·traction + 0.2·min(1, items/5). Evidence-based.
- summary + cost_saving_angle are written later by the DELIVER step (think()), not here.

### Denylist lesson (self-heal 2026-06-02)
- v1 denylist missed a trading-spam repo because GitHub names use hyphens not slashes
  (`discord.gg-xxx`) and said "Indicators" not "signal". Tightened: drop trading/forex/signals/
  indicators/pinescript, and match `discord.gg` followed by / _ or -. Re-verified.
