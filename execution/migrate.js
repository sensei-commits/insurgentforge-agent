// TOOL: schema migration (implements SOP-01).
// Idempotent — uses CREATE TABLE IF NOT EXISTS. Safe to run repeatedly.
// Only creates/owns vg_* tables. Never touches Helena's tables.
const { pool, query } = require("./db");

const STATEMENTS = [
  `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`, // for gen_random_uuid()

  `CREATE TABLE IF NOT EXISTS vg_runs (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind          text NOT NULL CHECK (kind IN ('deep','light')),
    started_at    timestamptz NOT NULL DEFAULT now(),
    finished_at   timestamptz,
    trends_found  int NOT NULL DEFAULT 0,
    trends_skipped_single_source int NOT NULL DEFAULT 0,
    trigger       text NOT NULL DEFAULT 'manual',
    notes         text
  );`,

  `CREATE TABLE IF NOT EXISTS vg_signals (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          uuid REFERENCES vg_runs(id) ON DELETE CASCADE,
    source          text NOT NULL,
    url             text NOT NULL CHECK (length(url) > 0),
    signal_type     text NOT NULL CHECK (signal_type IN ('overpay','pain','demand','trend')),
    quote_or_metric text,
    raw             jsonb,
    fetched_at      timestamptz NOT NULL DEFAULT now()
  );`,

  `CREATE TABLE IF NOT EXISTS vg_trends (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint         text UNIQUE NOT NULL,
    title               text NOT NULL,
    summary             text,
    signal_type         text CHECK (signal_type IN ('overpay','pain','demand','trend')),
    confidence          numeric NOT NULL DEFAULT 0,
    corroboration_count int NOT NULL DEFAULT 1,
    cost_saving_angle   text,
    url                 text,
    status              text NOT NULL DEFAULT 'watch' CHECK (status IN ('ironclad','watch')),
    first_seen          timestamptz NOT NULL DEFAULT now(),
    last_seen           timestamptz NOT NULL DEFAULT now()
  );`,

  // additive column for existing installs (idempotent)
  `ALTER TABLE vg_trends ADD COLUMN IF NOT EXISTS url text;`,

  `CREATE TABLE IF NOT EXISTS vg_drafts (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trend_id      uuid REFERENCES vg_trends(id) ON DELETE SET NULL,
    platform      text NOT NULL,
    title         text,
    body          text NOT NULL,
    voice_check   jsonb,
    refusal       jsonb,
    status        text NOT NULL DEFAULT 'pending_approval'
                  CHECK (status IN ('pending_approval','approved','published','rejected','manual')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    delivered_at  timestamptz,
    published_at  timestamptz,
    published_url text,
    scheduled_publish_at timestamptz
  );`,

  // additive column for scheduled publishing (idempotent)
  `ALTER TABLE vg_drafts ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz;`,

  `CREATE TABLE IF NOT EXISTS vg_subreddit_rules (
    subreddit            text PRIMARY KEY,
    min_karma            int NOT NULL DEFAULT 0,
    min_account_age_days int NOT NULL DEFAULT 0,
    allows_self_promo    boolean NOT NULL DEFAULT false,
    notes                text
  );`,
];

async function migrate() {
  console.log("— Migrating vg_* schema —");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const stmt of STATEMENTS) {
      await client.query(stmt);
    }
    await client.query("COMMIT");

    // Report what now exists.
    const { rows } = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name LIKE 'vg_%' ORDER BY table_name;`
    );
    console.log("✅ Migration complete. vg_ tables present:");
    rows.forEach((r) => console.log(`   • ${r.table_name}`));
    return true;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("❌ Migration failed (rolled back):", err.message);
    return false;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

module.exports = { migrate };
if (require.main === module) migrate().then((ok) => { process.exitCode = ok ? 0 : 1; });
