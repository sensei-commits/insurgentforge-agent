// TOOL: Stack Overflow collector (implements SOP-03).
// Free public API — no key needed for basic queries (300 req/day unauthenticated).
// Captures DEMAND signal: people asking questions about Discord bots = active need.
// Pure function — returns normalized signals, no DB writes.

const API = "https://api.stackexchange.com/2.3";

// Search queries + concept hints that align with our cost-cutting research fingerprints.
const QUERIES = [
  { q: "discord bot alternative",     type: "overpay", hint: "overpay:alternative"   },
  { q: "discord bot not working",     type: "pain",    hint: "pain:not-working"       },
  { q: "free discord bot",            type: "overpay", hint: "overpay:free-bot"       },
  { q: "custom discord bot",          type: "demand",  hint: "demand:custom-build"    },
  { q: "discord music bot",           type: "pain",    hint: "feat:music"             },
  { q: "discord moderation bot",      type: "demand",  hint: "feat:moderation"        },
];

/**
 * @param {object} opts
 * @param {number} opts.minScore  minimum question score (default 1)
 * @param {number} opts.pagesize  results per query (default 10)
 */
async function collectStackOverflow({ minScore = 1, pagesize = 10 } = {}) {
  const signals = [];

  for (const { q, type, hint } of QUERIES) {
    const url =
      `${API}/search?order=desc&sort=votes&intitle=${encodeURIComponent(q)}` +
      `&site=stackoverflow&pagesize=${pagesize}&filter=!nNPvSNdWme`;

    let data;
    try {
      const r = await fetch(url, { headers: { "User-Agent": "insurgentforge-vanguard/0.1" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      data = await r.json();
    } catch (err) {
      console.warn(`[stackoverflow] ⚠️ "${q}" failed: ${err.message}`);
      continue;
    }

    const items = (data.items || []).filter((i) => (i.score || 0) >= minScore);
    if (!items.length) continue;

    // Use the top (most-voted) question as the representative signal.
    const top = items[0];
    const totalViews = items.reduce((s, i) => s + (i.view_count || 0), 0);
    const avgScore = (items.reduce((s, i) => s + (i.score || 0), 0) / items.length).toFixed(1);
    const metric = `${items.length} questions found, top has ${top.score} votes, ${top.view_count || 0} views`;

    signals.push({
      source: "stackoverflow",
      url: top.link || `https://stackoverflow.com/search?q=${encodeURIComponent(q)}`,
      signal_type: type,
      quote_or_metric: metric,
      title: `Stack Overflow: "${q}" (${items.length} questions)`,
      fingerprintHint: hint,
      raw: {
        description: top.title || q,
        keyword: q,
        question_count: items.length,
        top_score: top.score,
        total_views: totalViews,
        avg_score: parseFloat(avgScore),
      },
    });
  }

  return signals;
}

module.exports = { collectStackOverflow };
