// VERIFY: exercise both AI paths with real brand-relevant tasks.
const { think, quick } = require("./ai");

async function main() {
  // quick() — classify a signal into one of the 4 types (bulk/fast path → Groq).
  const classify = await quick({
    system:
      "Classify a Discord-community signal into exactly one word: overpay, pain, demand, or trend. Reply with only that word.",
    prompt:
      'A user posts: "We pay $12/mo for MEE6 premium just to get role menus and a leveling system."',
    maxTokens: 5,
    temperature: 0,
  });
  console.log(`quick() classified as: "${classify.text}" (via ${classify.provider})`);

  // think() — write one brand-voice line (quality path → DeepSeek).
  const write = await think({
    system:
      "You are Vanguard, voice of InsurgentForge. Casual peer-to-peer, no AI cliches, no emoji-stuffing. One sentence.",
    prompt:
      "Write ONE punchy sentence reacting to someone paying $12/mo for a Discord bot just for role menus and leveling.",
    maxTokens: 60,
    temperature: 0.8,
  });
  console.log(`think() wrote: "${write.text}" (via ${write.provider})`);
}

main().then(() => { process.exitCode = 0; }).catch((err) => {
  console.error("❌", err.message);
  process.exitCode = 1;
});
