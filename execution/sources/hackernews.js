// TOOL: Hacker News collector (implements SOP-03) via the free Algolia HN Search API.
// No key required. Pure function — returns normalized signals, no DB writes.

const SEARCH = "https://hn.algolia.com/api/v1/search";

function guessType(title) {
  const t = (title || "").toLowerCase();
  if (/\b(free|open[\s-]?source|self[\s-]?host|alternative|replace|cheap)\b/.test(t)) return "overpay";
  if (/\b(broken|down|expensive|overpriced|hate|frustrat|why is there no|missing)\b/.test(t)) return "pain";
  if (/\b(looking for|need|wish|request|anyone know)\b/.test(t)) return "demand";
  return "trend";
}

/**
 * @param {object} opts
 * @param {string} opts.query      search query (default "discord bot")
 * @param {number} opts.minPoints  minimum points to count (default 2)
 * @param {number} opts.max        max signals (default 15)
 */
async function collectHackerNews({ query = "discord bot", minPoints = 2, max = 15 } = {}) {
  const url = `${SEARCH}?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${max}`;
  const r = await fetch(url, { headers: { "User-Agent": "insurgentforge-vanguard" } });
  if (!r.ok) throw new Error(`HN HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();

  return (data.hits || [])
    .filter((h) => (h.points || 0) >= minPoints && h.title)
    .map((h) => ({
      source: "hackernews",
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      signal_type: guessType(h.title),
      quote_or_metric: `${h.points || 0} points, ${h.num_comments || 0} comments`,
      title: h.title,
      raw: {
        description: h.title,
        points: h.points,
        num_comments: h.num_comments,
        created_at: h.created_at,
        hn_url: `https://news.ycombinator.com/item?id=${h.objectID}`,
      },
    }));
}

module.exports = { collectHackerNews };
