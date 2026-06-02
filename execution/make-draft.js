// UTILITY: create ONE draft for the top opportunity on a given platform (default bluesky).
// Usage: node execution/make-draft.js [platform]
const { writeDraft } = require("./writer");
const { pool, query } = require("./db");

async function main() {
  const platform = process.argv[2] || "bluesky";
  const { rows } = await query(
    `SELECT id, title, summary, cost_saving_angle FROM vg_trends
     ORDER BY (status='ironclad') DESC, confidence DESC LIMIT 1`
  );
  if (!rows.length) throw new Error("No opportunities in DB — run research first.");
  const d = await writeDraft({ trend: rows[0], platform });
  if (d.blocked) {
    console.log(`Draft blocked by refusal gate: ${d.refusal.reason}`);
  } else {
    console.log(`✅ Created ${platform} draft ${d.id} (status ${d.status}).`);
    console.log(`Preview: ${(d.body || "").slice(0, 200)}`);
  }
  await pool.end();
}
main().then(() => { process.exitCode = 0; }).catch(async (e) => {
  console.error("❌", e.message); await pool.end().catch(() => {}); process.exitCode = 1;
});
