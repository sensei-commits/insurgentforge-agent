// PROBE: Mastodon. Verifies the access token against the chosen instance by reading
// our own account (verify_credentials). Does NOT post anything.
const { ok, fail, warn, requireEnv } = require("./_env");

async function probeMastodon() {
  console.log("\n— Probe: Mastodon —");
  if (!requireEnv(["MASTODON_INSTANCE_URL", "MASTODON_ACCESS_TOKEN"])) {
    fail("Mastodon creds incomplete. Create an app token in Preferences → Development.");
    return false;
  }
  const base = process.env.MASTODON_INSTANCE_URL.replace(/\/+$/, "");
  try {
    const r = await fetch(`${base}/api/v1/accounts/verify_credentials`, {
      headers: { Authorization: `Bearer ${process.env.MASTODON_ACCESS_TOKEN}` },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${await r.text()}`);
    const d = await r.json();
    ok(`Verified as @${d.username} on ${base.replace("https://", "")}.`);
    return true;
  } catch (err) {
    fail(`Mastodon check failed: ${err.message}`);
    warn("Check the instance URL (include https://) and that the token has write scope.");
    return false;
  }
}

module.exports = { probeMastodon };
if (require.main === module) probeMastodon().then((pass) => { process.exitCode = pass ? 0 : 1; });
