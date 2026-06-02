// NAVIGATION + DELIVER: run one deep research cycle and post the report to #trends.
// collect (GitHub + HN + Google Trends) → score/store → AI-summarize top opportunities → deliver to Discord.
const { collectGithub } = require("./sources/github");
const { collectHackerNews } = require("./sources/hackernews");
const { collectGoogleTrends } = require("./sources/google-trends");
const { collectStackOverflow } = require("./sources/stackoverflow");
const { scoreAndStore } = require("./score");
const { think } = require("./ai");
const { postToTrends, ORCA } = require("./discord");
const { pool, query } = require("./db");

const SYSTEM = `You are Vanguard, the research voice of InsurgentForge (cost-cutting Discord bot builder).
Voice: casual peer-to-peer, no AI cliches, no emoji. InsurgentForge REPLACES overpriced/bloated bots
with cheaper custom builds — never "teaches building". Be concrete and honest. No hype.`;

// Write a 2-sentence brand-voice take + cost-saving angle for one opportunity.
async function summarize(t) {
  const { text } = await think({
    system: SYSTEM,
    prompt:
      `Opportunity: "${t.title}" (type: ${t.signal_type}, evidence: ${t.url}).\n` +
      `In 2 short sentences: (1) what the opportunity is, (2) the cost-cutting angle for InsurgentForge ` +
      `(what people overpay for here vs. a leaner custom build). No preamble, no hashtags.`,
    maxTokens: 120,
    temperature: 0.7,
  });
  return text.trim();
}

async function runDeepResearch({ trigger = "manual", featured = 5 } = {}) {
  // 1) collect from 4 independent sources
  const [gh, hn, gt, so] = await Promise.all([
    collectGithub({ sinceDays: 90, minStars: 3, max: 25 }),
    collectHackerNews({ query: "discord bot", minPoints: 1, max: 25 }),
    collectGoogleTrends({ minValue: 5 }),
    collectStackOverflow(),
  ]);

  // 2) filter + score + persist
  const summary = await scoreAndStore([...gh, ...hn, ...gt, ...so], { runKind: "deep", trigger });

  // 3) pick top opportunities (ironclad first, then confidence)
  const { rows: top } = await query(
    `SELECT id, title, signal_type, status, confidence, corroboration_count, url
     FROM vg_trends ORDER BY (status='ironclad') DESC, confidence DESC LIMIT $1`,
    [featured]
  );

  // 4) AI-summarize each + save back
  for (const t of top) {
    try {
      const blurb = await summarize(t);
      t._blurb = blurb;
      await query(`UPDATE vg_trends SET summary=$2 WHERE id=$1`, [t.id, blurb]);
    } catch (e) {
      t._blurb = "(summary unavailable)";
    }
  }

  // 5) build + deliver the report embed
  const fields = top.map((t) => {
    const icon = t.status === "ironclad" ? "⭐" : "👁️";
    const srcCount = t.corroboration_count >= 2 ? `${t.corroboration_count} sources` : "1 source";
    return {
      name: `${icon} ${t.title}`.slice(0, 256),
      value: `${t._blurb}\n*${t.status} · conf ${t.confidence} · ${srcCount}* — [evidence](${t.url})`.slice(0, 1024),
    };
  });

  await postToTrends({
    embeds: [
      {
        title: `${ORCA} Vanguard — Opportunity Report`,
        description:
          `Scanned **GitHub · HN · Google Trends · Stack Overflow** for cost-cutting openings in the Discord-bot niche.\n` +
          `**${summary.trendsFound}** opportunities · **${summary.ironclad}** ironclad (3+ sources) · ` +
          `**${summary.watch}** on watch · **${summary.dropped}** junk filtered out.`,
        color: 0x1f6feb,
        fields,
        footer: { text: `InsurgentForge • Vanguard • run ${summary.runId.slice(0, 8)}` },
        timestamp: new Date().toISOString(),
      },
    ],
  });

  return summary;
}

module.exports = { runDeepResearch };
module.exports = { runDeepResearch };

if (require.main === module) {
  runDeepResearch({ trigger: "manual" })
    .then((s) => { console.log(`✅ Report delivered. ${s.ironclad} ironclad, ${s.watch} watch, ${s.dropped} dropped.`); process.exitCode = 0; })
    .catch((e) => { console.error("❌", e.message); process.exitCode = 1; })
    .finally(() => pool.end().catch(() => {}));
}
