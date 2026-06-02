// VERIFY: generate platform drafts from a real opportunity + prove the refusal gate works.
const { writeDraft } = require("./writer");
const { pool, query } = require("./db");

async function main() {
  // grab the top opportunity (prefer ironclad)
  const { rows } = await query(
    `SELECT id, title, summary, cost_saving_angle FROM vg_trends
     ORDER BY (status='ironclad') DESC, confidence DESC LIMIT 1`
  );
  if (!rows.length) throw new Error("No trends in DB — run research first.");
  const trend = rows[0];
  console.log(`Opportunity: "${trend.title}"\n`);

  for (const platform of ["bluesky", "mastodon", "devto"]) {
    const d = await writeDraft({ trend, platform });
    console.log(`\n========== ${platform.toUpperCase()} (${d.status}) ==========`);
    if (d.blocked) {
      console.log(`⚠️ BLOCKED by refusal gate: ${d.refusal.reason}`);
      continue;
    }
    if (d.title) console.log(`TITLE: ${d.title}`);
    console.log(d.body);
    console.log(`— voice_check: human=${d.voice_check.sounds_human}, cliches=[${d.voice_check.ai_cliches_found}], dup=${d.voice_check.duplicate_of}`);
  }

  // refusal gate test — a clearly political topic must be blocked
  console.log(`\n========== REFUSAL GATE TEST ==========`);
  const fake = { id: null, title: "Why the election results prove our political party is right", summary: "political hot take" };
  const blocked = await writeDraft({ trend: fake, platform: "bluesky" });
  console.log(`Political topic → blocked=${blocked.blocked}, reason="${blocked.refusal.reason}", status=${blocked.status}`);

  await pool.end();
}

main().then(() => { process.exitCode = 0; }).catch(async (e) => {
  console.error("❌", e.message); await pool.end().catch(() => {}); process.exitCode = 1;
});
