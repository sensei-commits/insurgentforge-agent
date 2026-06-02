// PROBE RUNNER: runs every link check and prints a final green/red summary.
// Phase L rule: a broken link halts the build. Fix red links before Phase A.
const { probeDb } = require("./probe-db");
const { probeAi } = require("./probe-ai");
const { probeReddit } = require("./probe-reddit");
const { probeDiscord } = require("./probe-discord");
const { probeBluesky } = require("./probe-bluesky");
const { probeMastodon } = require("./probe-mastodon");
const { probeDevto } = require("./probe-devto");

(async () => {
  console.log("============================================");
  console.log(" INSURGENTFORGE AGENT — PHASE L LINK CHECKS ");
  console.log("============================================");

  const results = {
    Database: await probeDb(),
    AI: await probeAi(),
    Reddit: await probeReddit(),
    Discord: await probeDiscord(),
    Bluesky: await probeBluesky(),
    Mastodon: await probeMastodon(),
    "Dev.to": await probeDevto(),
  };

  console.log("\n—————————— SUMMARY ——————————");
  let allGreen = true;
  for (const [name, pass] of Object.entries(results)) {
    console.log(`${pass ? "✅" : "❌"}  ${name}`);
    if (!pass) allGreen = false;
  }
  console.log("——————————————————————————————");
  console.log(
    allGreen
      ? "\n🟢 ALL LINKS GREEN — cleared to enter Phase A (ARCHITECT)."
      : "\n🔴 One or more links are red. Phase A is HALTED until every link is green."
  );
  process.exitCode = allGreen ? 0 : 1;
})();
