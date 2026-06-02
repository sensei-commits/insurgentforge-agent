// VERIFY: collect from GitHub → filter/score/store → print summary + read back from DB.
const { collectGithub } = require("./sources/github");
const { scoreAndStore } = require("./score");
const { pool, query } = require("./db");

async function main() {
  const signals = await collectGithub({ sinceDays: 60, minStars: 5, max: 20 });
  console.log(`Collected ${signals.length} raw signals from GitHub.`);

  const summary = await scoreAndStore(signals, { runKind: "deep", trigger: "manual" });
  console.log("\n— Scoring summary —");
  console.log(`  trends found:   ${summary.trendsFound}`);
  console.log(`  ironclad (2+):  ${summary.ironclad}`);
  console.log(`  watch (1 src):  ${summary.watch}`);
  console.log(`  dropped (junk): ${summary.dropped}`);
  if (summary.droppedTitles.length) {
    console.log("  dropped titles:");
    summary.droppedTitles.forEach((t) => console.log(`    🚫 ${t}`));
  }

  console.log("\n— Top stored opportunities (from DB) —");
  const { rows } = await query(
    `SELECT title, signal_type, status, confidence, corroboration_count
     FROM vg_trends ORDER BY status DESC, confidence DESC LIMIT 10`
  );
  rows.forEach((r) =>
    console.log(
      `  [${r.status}] ${r.title} — ${r.signal_type}, conf ${r.confidence}, x${r.corroboration_count}`
    )
  );

  await pool.end();
}

main().then(() => { process.exitCode = 0; }).catch(async (err) => {
  console.error("❌", err.message);
  await pool.end().catch(() => {});
  process.exitCode = 1;
});
