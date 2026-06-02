# SOP-01 — Data Layer (Source of Truth)

**Layer:** A (Architecture) — defines the contract the `db.js` tool implements.
**Golden Rule:** if the data model changes, update THIS doc before touching code.

## Goal
Give Vanguard a deterministic memory in the existing Railway Postgres (shared with Helena).
All tables are prefixed **`vg_`** (Vanguard) so they never collide with Helena's tables.

## Why these tables
The system has two pipelines (research → delivery, and draft → approve → publish). State must
survive restarts and prevent two failure modes the North Star can't tolerate:
- **Re-flagging the same trend** (annoying, looks dumb) → dedup via `vg_trends.fingerprint`.
- **Double-posting / posting without approval** → `vg_drafts.status` lifecycle is the gate.

## Tables

### `vg_runs` — one row per research run (audit + dedup window)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| kind | text | 'deep' \| 'light' |
| started_at | timestamptz | |
| finished_at | timestamptz | null until done |
| trends_found | int | |
| trends_skipped_single_source | int | enforces the 2-source rule, visibly |
| trigger | text | 'cron' \| 'manual' |
| notes | text | errors / summary |

### `vg_signals` — raw evidence collected from sources (the "ironclad" backing)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| run_id | uuid FK→vg_runs | |
| source | text | 'github'\|'reddit'\|'hackernews'\|'google_trends'\|'youtube' |
| url | text | direct link (required — no link, no ironclad) |
| signal_type | text | 'overpay'\|'pain'\|'demand'\|'trend' |
| quote_or_metric | text | the hard evidence (a quote or a number) |
| raw | jsonb | original item for re-analysis |
| fetched_at | timestamptz | |

### `vg_trends` — corroborated opportunities (what lands in #trends)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| fingerprint | text UNIQUE | normalized key for dedup (never re-flag) |
| title | text | short human label |
| summary | text | what it is + why it matters (brand voice) |
| signal_type | text | dominant type (overpay/pain/demand/trend) |
| confidence | numeric | derived from EVIDENCE strength, not model vibes |
| corroboration_count | int | must be >= 2 to be 'ironclad' |
| cost_saving_angle | text | what they overpay for → what IF could build |
| status | text | 'ironclad' \| 'watch' (thin evidence) |
| first_seen | timestamptz | |
| last_seen | timestamptz | bumped if seen again (no new row) |

### `vg_drafts` — generated posts awaiting approval / publishing
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| trend_id | uuid FK→vg_trends | nullable |
| platform | text | 'reddit'\|'bluesky'\|'mastodon'\|'devto'\|'discord'\|'twitter'\|'linkedin'\|'instagram' |
| title | text | |
| body | text | |
| voice_check | jsonb | { sounds_human, ai_cliches_found[], duplicate_of } |
| refusal | jsonb | { blocked, reason } — if blocked, no ✅ shown |
| status | text | 'pending_approval'\|'approved'\|'published'\|'rejected'\|'manual' |
| created_at | timestamptz | |
| delivered_at | timestamptz | when shown in Discord |
| published_at | timestamptz | |
| published_url | text | link to the live post |

### `vg_subreddit_rules` — per-sub gate for the new-account warm-up
| column | type | notes |
|---|---|---|
| subreddit | text PK | e.g. 'Discord_Bots' |
| min_karma | int | |
| min_account_age_days | int | |
| allows_self_promo | bool | |
| notes | text | |

## Invariants (enforced in code, asserted by tests)
1. `vg_trends.fingerprint` is UNIQUE → inserting a dup bumps `last_seen`, never creates a row.
2. A trend is `status='ironclad'` ONLY if `corroboration_count >= 2`; else `'watch'`.
3. A draft can reach `status='published'` ONLY from `'approved'` (or `'manual'` for paste-channels).
4. Every `vg_signals` row MUST have a non-empty `url`.

## Migration behavior
- `migrate.js` is idempotent: `CREATE TABLE IF NOT EXISTS`. Safe to run repeatedly.
- Never drops/alters Helena tables. Only creates/owns `vg_*`.
