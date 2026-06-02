// TOOL: Discord delivery (REST API, no gateway needed for sending).
// Vanguard posts trend reports + draft-approval messages here. Atomic + reusable.
require("dotenv").config();

const API = "https://discord.com/api/v10";
const TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.DISCORD_OWNER_ID;
const ORCA = "🐋"; // Vanguard mascot

// Low-level send. Returns the created message object.
async function sendMessage(channelId, { content, embeds, components } = {}) {
  if (!TOKEN) throw new Error("DISCORD_TOKEN not set.");
  const body = {
    content: content || undefined,
    embeds: embeds || undefined,
    components: components || undefined,
    // Only allow pinging the owner — never @everyone/@here by accident.
    allowed_mentions: { users: OWNER_ID ? [OWNER_ID] : [] },
  };
  const r = await fetch(`${API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Discord send failed: HTTP ${r.status} ${await r.text()}`);
  return r.json();
}

// Build an @owner mention string (empty if owner id missing).
function pingOwner() {
  return OWNER_ID ? `<@${OWNER_ID}>` : "";
}

// Convenience: post to the #trends channel, pinging the owner.
async function postToTrends({ content, embeds, components } = {}) {
  const channelId = process.env.DISCORD_TRENDS_CHANNEL_ID;
  if (!channelId) throw new Error("DISCORD_TRENDS_CHANNEL_ID not set.");
  const ping = pingOwner();
  const merged = ping ? `${ping}${content ? " " + content : ""}` : content;
  return sendMessage(channelId, { content: merged, embeds, components });
}

module.exports = { sendMessage, postToTrends, pingOwner, ORCA };
