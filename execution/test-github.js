// VERIFY: pull real, recent Discord-bot repos from GitHub and print normalized signals.
const { collectGithub } = require("./sources/github");

async function main() {
  const signals = await collectGithub({ sinceDays: 60, minStars: 5, max: 10 });
  console.log(`Pulled ${signals.length} signals from GitHub:\n`);
  for (const s of signals) {
    console.log(`• [${s.signal_type}] ${s.title} — ${s.quote_or_metric}`);
    console.log(`  ${s.url}`);
    if (s.raw.description) console.log(`  "${s.raw.description.slice(0, 100)}"`);
    console.log("");
  }
}

main().then(() => { process.exitCode = 0; }).catch((err) => {
  console.error("❌", err.message);
  process.exitCode = 1;
});
