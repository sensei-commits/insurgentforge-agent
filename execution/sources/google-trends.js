// TOOL: Google Trends collector (implements SOP-03).
// Uses the unofficial google-trends-api npm package — no API key needed.
// Pulls search DEMAND data: are people searching for "discord bot" alternatives?
// Pure function — returns normalized signals, no DB writes.
require("dotenv").config();

const googleTrends = require("google-trends-api");

// Queries + pre-assigned fingerprint hints (must match COST_CATEGORIES in score.js).
const QUERIES = [
  { q: "discord bot alternative",  type: "overpay", hint: "overpay:alternative"  },
  { q: "discord bot too expensive",type: "overpay", hint: "overpay:too-expensive"},
  { q: "free discord bot",         type: "overpay", hint: "overpay:free-bot"     },
  { q: "discord bot not working",  type: "pain",    hint: "pain:not-working"     },
  { q: "custom discord bot",       type: "demand",  hint: "demand:custom-build"  },
  { q: "discord bot builder",      type: "demand",  hint: "demand:custom-build"  },
];

/**
 * @param {object} opts
 * @param {string} opts.geo        country code (default 'US')
 * @param {string} opts.timeframe  Google Trends timeframe string (default 'today 3-m')
 * @param {number} opts.minValue   minimum interest value to surface (default 10, scale 0-100)
 */
async function collectGoogleTrends({ geo = "US", timeframe = "today 3-m", minValue = 10 } = {}) {
  const signals = [];

  for (const { q, type, hint } of QUERIES) {
    let data;
    try {
      const raw = await googleTrends.interestOverTime({
        keyword: q,
        geo,
        startTime: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days
      });
      data = JSON.parse(raw);
    } catch (err) {
      console.warn(`[google-trends] ⚠️ "${q}" failed: ${err.message}`);
      continue;
    }

    const timeline = data?.default?.timelineData || [];
    if (!timeline.length) continue;

    // Get the average and peak interest over the period.
    const values = timeline.map((t) => t.value?.[0] || 0);
    const peak = Math.max(...values);
    const recent = values.slice(-4).reduce((a, b) => a + b, 0) / 4; // last ~4 weeks avg
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    if (peak < minValue) continue; // no meaningful search interest

    // Trend direction: is it rising or falling?
    const trend = recent > avg * 1.1 ? "rising" : recent < avg * 0.9 ? "falling" : "stable";
    const metric = `peak ${peak}/100, recent avg ${recent.toFixed(0)}/100 (${trend})`;

    signals.push({
      source: "google_trends",
      url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(q)}&geo=${geo}`,
      signal_type: type,
      quote_or_metric: metric,
      title: `Google Trends: "${q}"`,
      fingerprintHint: hint,
      raw: {
        description: `Search demand for "${q}" — ${metric}`,
        keyword: q,
        peak,
        recent_avg: parseFloat(recent.toFixed(1)),
        avg: parseFloat(avg.toFixed(1)),
        direction: trend,
        geo,
      },
    });
  }

  return signals;
}

module.exports = { collectGoogleTrends };
