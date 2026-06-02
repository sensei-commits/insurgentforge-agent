// TOOL: GitHub collector (implements SOP-03).
// Pure function — pulls recently-created Discord bot repos gaining traction and returns
// normalized signals. Does NOT write to the DB. No key required (optional GITHUB_TOKEN
// raises the rate limit from 10 → 30 search req/min).
require("dotenv").config();

const SEARCH = "https://api.github.com/search/repositories";

// Heuristic: repos pitching a FREE/open/self-host alternative are an "overpay" opportunity
// (validation that people want to escape paid bots). Otherwise it's a "trend" (rising adoption).
function guessType(text) {
  const t = (text || "").toLowerCase();
  if (/\b(free|open[\s-]?source|self[\s-]?host|no premium|alternative|replace)\b/.test(t)) {
    return "overpay";
  }
  return "trend";
}

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

/**
 * @param {object} opts
 * @param {number} opts.sinceDays  how far back to look for NEW repos (default 30)
 * @param {number} opts.minStars   minimum stars to count as traction (default 5)
 * @param {number} opts.max        max signals to return (default 15)
 * @returns {Promise<Array>} normalized signals
 */
async function collectGithub({ sinceDays = 30, minStars = 5, max = 15 } = {}) {
  const q = `discord bot in:name,description created:>${isoDaysAgo(sinceDays)} stars:>=${minStars}`;
  const url = `${SEARCH}?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${max}`;

  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "insurgentforge-vanguard", // GitHub requires a UA
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`GitHub HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();

  return (data.items || []).map((repo) => ({
    source: "github",
    url: repo.html_url,
    signal_type: guessType(`${repo.name} ${repo.description}`),
    quote_or_metric: `${repo.stargazers_count}★, created ${repo.created_at.slice(0, 10)}`,
    title: repo.full_name,
    raw: {
      description: repo.description,
      language: repo.language,
      stars: repo.stargazers_count,
      created_at: repo.created_at,
      pushed_at: repo.pushed_at,
    },
  }));
}

module.exports = { collectGithub };
