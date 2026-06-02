// UTILITY: wipe vg_ research/draft test data for a clean re-run.
// Safe — only touches vg_* tables, leaves schema intact. Dev use only.
const { pool, query } = require("./db");

async function main() {
  await query("TRUNCATE vg_signals, vg_drafts, vg_trends, vg_runs RESTART IDENTITY CASCADE;");
  console.log("✅ vg_ research/draft tables truncated (schema kept).");
  await pool.end();
}
main().then(() => { process.exitCode = 0; }).catch(async (e) => {
  console.error("❌", e.message); await pool.end().catch(() => {}); process.exitCode = 1;
});
