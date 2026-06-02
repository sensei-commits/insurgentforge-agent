// PROBE: Reddit API (script app, password grant).
// Confirms we can get an OAuth token and read our own identity. Does NOT post anything.
const { ok, fail, warn, requireEnv } = require("./_env");

async function probeReddit() {
  console.log("\n— Probe: Reddit API —");
  const needed = [
    "REDDIT_CLIENT_ID",
    "REDDIT_CLIENT_SECRET",
    "REDDIT_USERNAME",
    "REDDIT_PASSWORD",
    "REDDIT_USER_AGENT",
  ];
  if (!requireEnv(needed)) {
    fail("Reddit creds incomplete. Create a 'script' app at reddit.com/prefs/apps.");
    return false;
  }

  try {
    // 1. Get an OAuth access token via password grant (script apps).
    const basic = Buffer.from(
      `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
    ).toString("base64");

    const form = new URLSearchParams({
      grant_type: "password",
      username: process.env.REDDIT_USERNAME,
      password: process.env.REDDIT_PASSWORD,
    });

    const tokenRes = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": process.env.REDDIT_USER_AGENT,
      },
      body: form,
    });

    if (!tokenRes.ok) {
      throw new Error(`token request HTTP ${tokenRes.status} — ${await tokenRes.text()}`);
    }
    const token = (await tokenRes.json()).access_token;
    if (!token) throw new Error("no access_token returned (check username/password/2FA).");

    // 2. Use the token to read our own identity (read-only, harmless).
    const meRes = await fetch("https://oauth.reddit.com/api/v1/me", {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": process.env.REDDIT_USER_AGENT,
      },
    });
    if (!meRes.ok) throw new Error(`/me HTTP ${meRes.status}`);
    const me = await meRes.json();
    ok(`Authenticated as u/${me.name} (link karma: ${me.link_karma}).`);
    return true;
  } catch (err) {
    fail(`Reddit auth failed: ${err.message}`);
    warn("Common causes: 2FA on the account (use an app password), wrong app type (must be 'script'), or typo in client id/secret.");
    return false;
  }
}

module.exports = { probeReddit };
if (require.main === module) probeReddit().then((pass) => { process.exitCode = pass ? 0 : 1; });
