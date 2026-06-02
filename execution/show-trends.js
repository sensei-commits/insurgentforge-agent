// UTILITY: print the top opportunities + their AI summaries from the DB.
const { pool, query } = require("./db");
(async () => {
  const { rows } = await query(
    `SELECT status, title, confidence, corroboration_count, summary
     FROM vg_trends ORDER BY (status='ironclad') DESC, confidence DESC LIMIT 5`
  );
  for (const r of rows) {
    console.log(`\n[${r.status.toUpperCase()}] ${r.title}  (conf ${r.confidence}, ${r.corroboration_count} src)`);
    console.log(r.summary || "(no summary)");
  }
  await pool.end();
})().then(() => { process.exitCode = 0; }).catch(async (e) => { console.error(e.message); await pool.end().catch(()=>{}); process.exitCode = 1; });
