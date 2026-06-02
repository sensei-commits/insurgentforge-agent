// TOOL: Bluesky publisher (AT Protocol). post() creates a skeet; remove() deletes one.
require("dotenv").config();

const BASE = "https://bsky.social/xrpc";

async function session() {
  const r = await fetch(`${BASE}/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: process.env.BLUESKY_HANDLE,
      password: process.env.BLUESKY_APP_PASSWORD,
    }),
  });
  if (!r.ok) throw new Error(`Bluesky session HTTP ${r.status}`);
  return r.json(); // { accessJwt, did, handle }
}

/** Publish a post. Returns { url, uri, rkey }. */
async function post(text) {
  const s = await session();
  const r = await fetch(`${BASE}/com.atproto.repo.createRecord`, {
    method: "POST",
    headers: { Authorization: `Bearer ${s.accessJwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      repo: s.did,
      collection: "app.bsky.feed.post",
      record: { $type: "app.bsky.feed.post", text: text.slice(0, 300), createdAt: new Date().toISOString() },
    }),
  });
  if (!r.ok) throw new Error(`Bluesky post HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  const d = await r.json(); // { uri, cid }
  const rkey = d.uri.split("/").pop();
  return { url: `https://bsky.app/profile/${s.handle}/post/${rkey}`, uri: d.uri, rkey };
}

/** Delete a post by rkey (used for safe verification cleanup). */
async function remove(rkey) {
  const s = await session();
  const r = await fetch(`${BASE}/com.atproto.repo.deleteRecord`, {
    method: "POST",
    headers: { Authorization: `Bearer ${s.accessJwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ repo: s.did, collection: "app.bsky.feed.post", rkey }),
  });
  if (!r.ok) throw new Error(`Bluesky delete HTTP ${r.status}`);
  return true;
}

module.exports = { post, remove };
