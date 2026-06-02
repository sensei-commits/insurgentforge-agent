// VERIFY: combine GitHub + Hacker News + Google Trends → score → watch ironclad trigger (3 sources).
const { collectGithub } = require("./sources/github");
const { collectHackerNews } = require("./sources/hackernews");
const { collectGoogleTrends } = require("./sources/google-trends");
const { collectStackOverflow } = require("./sources/stackoverflow");
const { scoreAndStore } = require("./score");
const { pool, query } = require("./db");

async function main() {
  await query("TRUNCATE vg_signals, vg_drafts, vg_trends, vg_runs RESTART IDENTITY CASCADE;");

  const [gh, hn, gt, so] = await Promise.all([
    collectGithub({ sinceDays: 90, minStars: 3, max: 25 }),
    collectHackerNews({ query: "discord bot", minPoints: 1, max: 25 }),
    collectGoogleTrends({ minValue: 5 }),
    collectStackOverflow(),
  ]);
  const total = gh.length + hn.length + gt.length + so.length;
  console.log(`Collected: ${gh.length} GitHub + ${hn.length} HN + ${gt.length} Google Trends + ${so.length} StackOverflow = ${total} signals`);

  const summary = await scoreAndStore([...gh, ...hn, ...gt, ...so], { runKind: "deep", trigger: "manual" });
  console.log("\n— Scoring summary —");
  console.log(`  trends found:   ${summary.trendsFound}`);
  console.log(`  IRONCLAD (2+):  ${summary.ironclad}`);
  console.log(`  watch (1 src):  ${summary.watch}`);
  console.log(`  dropped (junk): ${summary.dropped}`);

  console.log("\n— IRONCLAD opportunities (2+ independent sources) —");
  const { rows } = await query(
    `SELECT title, signal_type, confidence, corroboration_count
     FROM vg_trends WHERE status='ironclad' ORDER BY confidence DESC`
  );
  if (!rows.length) console.log("  (none yet)");
  rows.forEach((r) =>
    console.log(`  ⭐ ${r.title} — ${r.signal_type}, conf ${r.confidence}, ${r.corroboration_count} sources`)
  );

  await pool.end();
}

main().then(() => { process.exitCode = 0; }).catch(async (e) => {
  console.error("❌", e.message); await pool.end().catch(() => {}); process.exitCode = 1;
});
