// PREVIEW: generate a draft and print to terminal — no DB, no Discord, no redeploy needed.
// Usage: node execution/preview-draft.js [platform]
// Example: node execution/preview-draft.js bluesky
require("dotenv").config();
const { think } = require("./ai");
const { SPECS, findCliches } = require("./writer");

const platform = process.argv[2] || "bluesky";
const spec = SPECS[platform];
if (!spec) {
  console.error(`Unknown platform: ${platform}`);
  console.error(`Available: ${Object.keys(SPECS).join(", ")}`);
  process.exit(1);
}

// Fake trend for preview
const trend = {
  title: process.argv[3] || "MINE Discord Bot trending on GitHub",
  summary: "People are building their own mining game automations because paid bots charge too much for features nobody uses",
  cost_saving_angle: "paying $10-15/mo for a bot that does 2 things when a focused custom build costs less and does the one thing they actually need",
};

async function preview() {
  console.log(`\n🐋 Vanguard Draft Preview — ${platform.toUpperCase()}`);
  console.log("─".repeat(50));
  console.log(`Trend: "${trend.title}"`);
  console.log(`Angle: ${trend.cost_saving_angle}`);
  console.log("─".repeat(50));

  // Read VOICE from writer.js file directly
  const fs = require("fs");
  const writerSrc = fs.readFileSync(require.resolve("./writer"), "utf-8");
  const voiceMatch = writerSrc.match(/const VOICE = `([\s\S]*?)`;/);
  const voice = voiceMatch ? voiceMatch[1] : "You are a casual builder talking to peers.";

  const titleLine = spec.title ? "Return a TITLE line, then a blank line, then the BODY." : "Return ONLY the post text.";
  const { text } = await think({
    system: voice,
    prompt:
      `Write a ${platform} post (${spec.shape}, max ~${spec.max} chars) about this opportunity:\n` +
      `"${trend.title}" — ${trend.summary}\n` +
      `Cost-saving angle: ${trend.cost_saving_angle}\n` +
      `CRITICAL: sound AUTHENTIC and HUMAN. Use casual punctuation (fewer periods, more flow). ` +
      `NO em-dashes (—) and NO hyphens used as connectors or pauses (- between clauses). Keep it like texting a friend. Never say "lean custom build" — say it different every time. VARY your phrasing. ` +
      `This post should NOT sound like the last one you wrote.` +
      `${titleLine}\nNo hashtags unless natural. No preamble.`,
    maxTokens: spec.title ? 700 : 220,
    temperature: 0.85,
  });

  const draft = text.trim();
  console.log("\n" + draft);
  console.log("\n" + "─".repeat(50));

  // Voice check
  const cliches = findCliches(draft);
  const hasEmdash = draft.includes("—");
  const hasHyphenConnector = / - /.test(draft);
  console.log("\n📋 Voice check:");
  console.log(`  Clichés found: ${cliches.length ? cliches.join(", ") : "none ✅"}`);
  console.log(`  Em-dashes: ${hasEmdash ? "⚠️  found" : "none ✅"}`);
  console.log(`  Hyphen connectors: ${hasHyphenConnector ? "⚠️  found" : "none ✅"}`);
  console.log(`  Length: ${draft.length} / ${spec.max} chars`);
  console.log("");
}

preview().catch(e => { console.error("❌", e.message); process.exit(1); });
