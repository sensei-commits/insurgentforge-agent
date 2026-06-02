// VERIFY: send Vanguard's first message to #trends, pinging the owner.
// Proves the delivery path works end-to-end. Safe — one harmless message.
const { postToTrends, ORCA } = require("./discord");

async function main() {
  const msg = await postToTrends({
    content: "Vanguard is online.",
    embeds: [
      {
        title: `${ORCA} Vanguard — reporting for duty`,
        description:
          "Systems check complete. I'm wired into this channel and ready to hunt.\n\n" +
          "**What I'll do here:**\n" +
          "• Drop weekly deep-research reports on cost-cutting opportunities in the Discord-bot niche\n" +
          "• Ping you when something hot breaks\n" +
          "• Send post drafts with ✅ / ❌ buttons for your approval before anything goes live\n\n" +
          "_Build. Forge. Empower._",
        color: 0x1f6feb,
        footer: { text: "InsurgentForge • Vanguard v0.1" },
        timestamp: new Date().toISOString(),
      },
    ],
  });
  console.log(`✅ Message delivered to #trends (message id ${msg.id}).`);
}

main().then(() => { process.exitCode = 0; }).catch((err) => {
  console.error("❌", err.message);
  process.exitCode = 1;
});
