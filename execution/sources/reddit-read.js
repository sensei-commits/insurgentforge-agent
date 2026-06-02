// TOOL: Reddit read-only collector (implements SOP-03).
// Uses Reddit's free public JSON API — no OAuth, no app credentials, no auth at all.
// Pure function — returns normalized signals, no DB writes.
// Targets subreddits where cost-cutting opportunities actually surface.
require("dotenv").config();

const SUBREDDITS = [
  "Discord_Bots",
  "discordapp",
  "discordbots",
];

// Cost-cutting / overpay signal keywords — flag posts that mention paying for bots.
const OVERPAY_RE = /\b(pay(ing)?|paid|subscription|premium|worth|price|cost|\$\d|expensive|overpriced|cancel|refund|cheaper|alternative)\b/i;
const PAIN_RE    = /\b(broken|not working|down|outage|limit|restrict|ban|annoying|hate|worst|disappoint|miss(ing)?)\b/i;
const DEMAND_RE  = /\b(looking for|need|want|wish|anyone know|is there a|recommend|suggest|feature request)\b/i;

function guessType(title, body = "") {
  const t = `${title} ${body}`.toLowerCase();
  if (OVERPAY_RE.test(t)) return "overpay";
  if (PAIN_RE.test(t))    return "pain";
  if (DEMAND_RE.test(t))  return "demand";
  return "trend";
}

/**
 * @param {object} opts
 * @param {string[]} opts.subreddits  list of subreddits to scan (default SUBREDDITS)
 * @param {number}   opts.limit       posts per subreddit (default 25)
 * @param {string}   opts.sort        'hot' | 'new' | 'top' (default 'hot')
 * @param {number}   opts.minScore    minimum upvotes (default 2)
 */
async function collectRedditRead({
  subreddits = SUBREDDITS,
  limit = 25,
  sort = "hot",
  minScore = 2,
} = {}) {
  const signals = [];

  for (const sub of subreddits) {
    const url = `https://www.reddit.com/r/${sub}/${sort}.json?limit=${limit}&raw_json=1`;
    let data;
    try {
      const r = await fetch(url, {
        headers: {
          // Reddit requires a descriptive User-Agent or it rate-limits aggressively.
          "User-Agent": "insurgentforge-vanguard/0.1 (read-only research; contact via discord)",
        },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      data = await r.json();
    } catch (err) {
      console.warn(`[reddit-read] ⚠️ r/${sub} failed: ${err.message}`);
      continue;
    }

    const posts = data?.data?.children || [];
    for (const { data: p } of posts) {
      if (!p.title || (p.score || 0) < minScore || p.is_self === false && !p.url) continue;
      if (p.stickied || p.distinguished) continue; // skip mod posts

      const type = guessType(p.title, p.selftext || "");
      const postUrl = `https://www.reddit.com${p.permalink}`;
      const metric = `${p.score} upvotes, ${p.num_comments || 0} comments`;

      signals.push({
        source: "reddit",
        url: postUrl,
        signal_type: type,
        quote_or_metric: metric,
        title: `r/${sub}: ${p.title}`.slice(0, 200),
        raw: {
          description: (p.selftext || "").slice(0, 300),
          subreddit: sub,
          score: p.score,
          num_comments: p.num_comments,
          created_utc: p.created_utc,
          author: p.author,
        },
      });
    }
  }

  return signals;
}

module.exports = { collectRedditRead };
