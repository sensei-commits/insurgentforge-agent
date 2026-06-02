// TOOL: scoring engine (implements SOP-03 — filter, cluster, score, persist).
// The ONLY module that writes vg_runs / vg_signals / vg_trends. Transactional.
require("dotenv").config();
const { pool } = require("./db");

// How many DISTINCT sources must agree to call an opportunity 'ironclad'. Tunable via .env.
const IRONCLAD_MIN_SOURCES = parseInt(process.env.IRONCLAD_MIN_SOURCES || "3", 10);

// ── Relevance + safety denylist (strict) ────────────────────────────────────
const DENY = [
  /\bself[\s-]?bot\b/i,
  /\btoken\s*(grab|logg|steal|tool)/i,
  /\b(nuker|nuke\sbot|raid|crash(er)?|ddos|doxx)/i,
  /\b(exam|quiz|test)\b.*\b(answer|bot|cheat)/i,
  /edgenuity|homework\s*bot|auto\s*answer/i,
  /\b(crypto\s*pump|airdrop|free\s*nitro|pump[\s-]?and[\s-]?dump)/i,
  // financial/trading content is off-niche for community Discord bots → drop
  /\b(trading|forex|signals?|indicators?|pinescript|pine\s*script)\b/i,
  /discord\.gg[\/_-]/i, // invite link stuffed in the name (slash OR hyphen/underscore) = spam
];

function isBanned(signal) {
  const text = `${signal.title || ""} ${signal.raw?.description || ""} ${signal.url || ""}`;
  return DENY.some((re) => re.test(text));
}

// ── Fingerprint: collapse a signal to a CONCEPT slug so signals from different sources cluster ──
// Two-tier: (1) cost/intent categories (span across all sources), (2) feature categories.
// A signal carries an optional `fingerprintHint` — if present, use it directly (collectors
// can pre-assign a meaningful concept key, e.g. Google Trends always knows its keyword intent).

const COST_CATEGORIES = [
  // These are the ones that matter most for the cost-cutting model.
  // Order matters: checked first, most specific first.
  ["alternative",      "overpay:alternative"],   // "free discord bot alternative"
  ["open-source",      "overpay:alternative"],
  ["open source",      "overpay:alternative"],
  ["self-host",        "overpay:alternative"],
  ["self host",        "overpay:alternative"],
  ["free discord bot", "overpay:free-bot"],
  ["cheaper",          "overpay:cheaper"],
  ["overpriced",       "overpay:overpriced"],
  ["subscription",     "overpay:subscription"],
  ["premium",          "overpay:premium"],
  ["too expensive",    "overpay:too-expensive"],
  ["not working",      "pain:not-working"],
  ["broken",           "pain:broken"],
  ["outage",           "pain:outage"],
  ["custom discord",   "demand:custom-build"],
  ["custom bot",       "demand:custom-build"],
];

const FEATURE_CATEGORIES = [
  "music", "moderation", "leveling", "ticket", "economy", "giveaway", "welcome",
  "dashboard", "analytics", "chatgpt", "translation", "reminder", "poll",
  "reaction role", "logging", "antispam", "verification", "stats", "utility",
  "ai bot", "ai assistant",
];

function fingerprintOf(signal) {
  // 0) Use a pre-assigned hint if the collector set one (cleanest path).
  if (signal.fingerprintHint) return signal.fingerprintHint;

  const text = `${signal.title || ""} ${signal.raw?.description || ""} ${signal.raw?.keyword || ""}`.toLowerCase();

  // 1) Check cost/intent categories (multi-source relevant).
  for (const [phrase, fp] of COST_CATEGORIES) {
    if (text.includes(phrase)) return fp;
  }

  // 2) Check feature categories (bot feature domains).
  const feat = FEATURE_CATEGORIES.find((c) => text.includes(c));
  if (feat) return `feat:${feat.replace(/\s+/g, "-")}`;

  // 3) Fallback: signal_type + first meaningful word (better than raw title).
  const words = (signal.title || "misc").toLowerCase().split(/[\/\s_\-:.!?]+/).filter((w) => w.length > 4 && !/^(https?|google|trends|show|from|with|your|that|this|they|have|been)$/.test(w));
  const word = words[0] || "misc";
  return `${signal.signal_type}:${word}`;
}

function tractionScore(signals) {
  const stars = signals.reduce((m, s) => Math.max(m, s.raw?.stars || 0), 0);
  return Math.min(1, stars / 500); // 500★ ≈ strong
}

/**
 * Filter → cluster → score → persist.
 * @returns summary { runId, trendsFound, ironclad, watch, dropped, droppedTitles }
 */
async function scoreAndStore(signals, { runKind = "deep", trigger = "manual" } = {}) {
  // 1) strict filter
  const dropped = signals.filter(isBanned);
  const kept = signals.filter((s) => !isBanned(s));

  // 2) cluster by fingerprint
  const clusters = new Map();
  for (const s of kept) {
    const fp = fingerprintOf(s);
    if (!clusters.has(fp)) clusters.set(fp, []);
    clusters.get(fp).push(s);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // open the run
    const run = await client.query(
      `INSERT INTO vg_runs (kind, trigger) VALUES ($1,$2) RETURNING id`,
      [runKind, trigger]
    );
    const runId = run.rows[0].id;

    let ironclad = 0;
    let watch = 0;

    for (const [fp, group] of clusters) {
      const distinctSources = new Set(group.map((g) => g.source)).size;
      // IRONCLAD = 2+ INDEPENDENT SOURCES (not just 2+ items). corroboration_count tracks
      // source diversity, so multiple GitHub repos on the same topic stay 'watch' (correct).
      const corroboration = distinctSources;
      const signalCount = group.length; // used only for confidence/traction richness
      const status = corroboration >= IRONCLAD_MIN_SOURCES ? "ironclad" : "watch";
      // Evidence-based confidence: source diversity dominates, then traction, then volume.
      const confidence = Math.min(
        1,
        0.4 * (distinctSources - 1) + // 0 for single-source, jumps when corroborated
        0.4 * tractionScore(group) +
        0.2 * Math.min(1, signalCount / 5)
      ).toFixed(2);
      const rep = group.slice().sort((a, b) => (b.raw?.stars || 0) - (a.raw?.stars || 0))[0];
      const dominantType = group[0].signal_type;
      const title = rep.title;

      // upsert the trend (dedup on fingerprint; re-seeing bumps corroboration + last_seen)
      const trend = await client.query(
        `INSERT INTO vg_trends (fingerprint, title, signal_type, confidence, corroboration_count, status, url)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (fingerprint) DO UPDATE SET
           corroboration_count = GREATEST(vg_trends.corroboration_count, EXCLUDED.corroboration_count),
           confidence = GREATEST(vg_trends.confidence, EXCLUDED.confidence),
           status = CASE WHEN GREATEST(vg_trends.corroboration_count, EXCLUDED.corroboration_count) >= $8
                         THEN 'ironclad' ELSE 'watch' END,
           url = COALESCE(vg_trends.url, EXCLUDED.url),
           last_seen = now()
         RETURNING id, status`,
        [fp, title, dominantType, confidence, corroboration, status, rep.url, IRONCLAD_MIN_SOURCES]
      );
      const trendId = trend.rows[0].id;
      if (trend.rows[0].status === "ironclad") ironclad++; else watch++;

      // store the backing evidence signals
      for (const s of group) {
        await client.query(
          `INSERT INTO vg_signals (run_id, source, url, signal_type, quote_or_metric, raw)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [runId, s.source, s.url, s.signal_type, s.quote_or_metric, s.raw || {}]
        );
      }
      // tag the evidence with the trend it backs (kept simple: separate column not needed for v1)
      void trendId;
    }

    // finalize the run
    await client.query(
      `UPDATE vg_runs SET finished_at = now(), trends_found = $2, trends_skipped_single_source = $3
       WHERE id = $1`,
      [runId, clusters.size, watch]
    );

    await client.query("COMMIT");
    return {
      runId,
      trendsFound: clusters.size,
      ironclad,
      watch,
      dropped: dropped.length,
      droppedTitles: dropped.map((d) => d.title),
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { scoreAndStore, isBanned, fingerprintOf };
