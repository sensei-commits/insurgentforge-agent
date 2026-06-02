// PROBE: Bluesky (AT Protocol). Confirms we can create a session (login) with the
// handle + app password. Does NOT post anything.
const { ok, fail, warn, requireEnv } = require("./_env");

async function probeBluesky() {
  console.log("\n— Probe: Bluesky —");
  if (!requireEnv(["BLUESKY_HANDLE", "BLUESKY_APP_PASSWORD"])) {
    fail("Bluesky creds incomplete. Create an App Password in Bluesky settings.");
    return false;
  }
  try {
    const r = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: process.env.BLUESKY_HANDLE,
        password: process.env.BLUESKY_APP_PASSWORD,
      }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${await r.text()}`);
    const d = await r.json();
    if (!d.accessJwt) throw new Error("no session token returned.");
    ok(`Logged in as ${d.handle} (did ${d.did.slice(0, 24)}…).`);
    return true;
  } catch (err) {
    fail(`Bluesky login failed: ${err.message}`);
    warn("Use an APP PASSWORD (not your main password), and the full handle e.g. name.bsky.social.");
    return false;
  }
}

module.exports = { probeBluesky };
if (require.main === module) probeBluesky().then((pass) => { process.exitCode = pass ? 0 : 1; });
