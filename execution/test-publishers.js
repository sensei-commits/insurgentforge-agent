// VERIFY: prove each publish path works end-to-end, then clean up (no public spam left behind).
const bsky = require("./publishers/bluesky");
const masto = require("./publishers/mastodon");
const devto = require("./publishers/devto");

const STAMP = `vanguard-selftest ${Date.now()}`;

async function main() {
  // Bluesky: post then delete
  try {
    const p = await bsky.post(`(ignore — automated self-test, deleting now) ${STAMP}`);
    console.log(`✅ Bluesky published: ${p.url}`);
    await bsky.remove(p.rkey);
    console.log(`   ↳ deleted (clean).`);
  } catch (e) { console.log(`❌ Bluesky: ${e.message}`); }

  // Mastodon: post then delete
  try {
    const p = await masto.post(`(ignore — automated self-test, deleting now) ${STAMP}`);
    console.log(`✅ Mastodon published: ${p.url}`);
    await masto.remove(p.id);
    console.log(`   ↳ deleted (clean).`);
  } catch (e) { console.log(`❌ Mastodon: ${e.message}`); }

  // Dev.to: create as DRAFT (never public), then unpublish to be safe
  try {
    const p = await devto.post({
      title: `Vanguard self-test (draft) ${STAMP}`,
      body: "This is an automated self-test draft. It is not published.",
      tags: ["test"],
      published: false,
    });
    console.log(`✅ Dev.to draft created (published=${p.published}): id ${p.id}`);
    await devto.unpublish(p.id);
    console.log(`   ↳ left as unpublished draft (not public).`);
  } catch (e) { console.log(`❌ Dev.to: ${e.message}`); }
}

main().then(() => { process.exitCode = 0; }).catch((e) => { console.error(e.message); process.exitCode = 1; });
