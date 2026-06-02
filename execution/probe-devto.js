// PROBE: Dev.to (Forem API). Verifies the API key by reading our own user.
// Does NOT publish any article.
const { ok, fail, warn, requireEnv } = require("./_env");

async function probeDevto() {
  console.log("\n— Probe: Dev.to —");
  if (!requireEnv(["DEVTO_API_KEY"])) {
    fail("DEVTO_API_KEY not set. Generate one at dev.to → Settings → Extensions.");
    return false;
  }
  try {
    const r = await fetch("https://dev.to/api/users/me", {
      headers: { "api-key": process.env.DEVTO_API_KEY, Accept: "application/vnd.forem.api-v1+json" },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${await r.text()}`);
    const d = await r.json();
    ok(`Authenticated as @${d.username} (${d.name}).`);
    return true;
  } catch (err) {
    fail(`Dev.to check failed: ${err.message}`);
    warn("Regenerate the API key in dev.to settings if this 401s.");
    return false;
  }
}

module.exports = { probeDevto };
if (require.main === module) probeDevto().then((pass) => { process.exitCode = pass ? 0 : 1; });
