// PROBE: Discord bot token + access to the InsurgentForge server and #trends channel.
// Confirms the token is valid, the bot is in the guild, and it can see the trends channel.
// Does NOT send any message. Uses the REST API directly (no gateway connection).
const { ok, fail, warn, requireEnv } = require("./_env");

const API = "https://discord.com/api/v10";

async function dapi(path, token) {
  const r = await fetch(API + path, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status} ${await r.text()}`);
  return r.json();
}

async function probeDiscord() {
  console.log("\n— Probe: Discord —");
  if (!requireEnv(["DISCORD_TOKEN"])) {
    fail("DISCORD_TOKEN not set. Create a bot at discord.com/developers/applications.");
    return false;
  }
  const token = process.env.DISCORD_TOKEN;

  try {
    // 1. Token valid? Identify the bot user.
    const me = await dapi("/users/@me", token);
    ok(`Token valid — bot is ${me.username}#${me.discriminator} (id ${me.id}).`);

    // 2. In the InsurgentForge guild?
    if (process.env.DISCORD_GUILD_ID) {
      try {
        const g = await dapi(`/guilds/${process.env.DISCORD_GUILD_ID}`, token);
        ok(`In server: "${g.name}".`);
      } catch {
        fail("Bot is NOT in the server (or wrong DISCORD_GUILD_ID). Invite it with proper perms.");
        return false;
      }
    } else {
      warn("DISCORD_GUILD_ID not set — skipping server check.");
    }

    // 3. Can it see #trends?
    if (process.env.DISCORD_TRENDS_CHANNEL_ID) {
      try {
        const c = await dapi(`/channels/${process.env.DISCORD_TRENDS_CHANNEL_ID}`, token);
        ok(`Can see channel: #${c.name}.`);
      } catch {
        fail("Cannot see the #trends channel (wrong ID or missing View Channel permission).");
        return false;
      }
    } else {
      warn("DISCORD_TRENDS_CHANNEL_ID not set — skipping channel check.");
    }

    if (!process.env.DISCORD_OWNER_ID) {
      warn("DISCORD_OWNER_ID not set — needed later so the bot can @ping you.");
    }
    return true;
  } catch (err) {
    fail(`Discord check failed: ${err.message}`);
    warn("If token is invalid, reset it in the Developer Portal and paste the new one.");
    return false;
  }
}

module.exports = { probeDiscord };
if (require.main === module) probeDiscord().then((pass) => { process.exitCode = pass ? 0 : 1; });
