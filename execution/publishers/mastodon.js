// TOOL: Mastodon publisher. post() toots; remove() deletes a toot.
require("dotenv").config();

function base() {
  return (process.env.MASTODON_INSTANCE_URL || "").replace(/\/+$/, "");
}
function auth() {
  return { Authorization: `Bearer ${process.env.MASTODON_ACCESS_TOKEN}` };
}

/** Publish a toot. Returns { url, id }. */
async function post(text) {
  const r = await fetch(`${base()}/api/v1/statuses`, {
    method: "POST",
    headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify({ status: text.slice(0, 500) }),
  });
  if (!r.ok) throw new Error(`Mastodon post HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return { url: d.url, id: d.id };
}

/** Delete a toot by id (verification cleanup). */
async function remove(id) {
  const r = await fetch(`${base()}/api/v1/statuses/${id}`, { method: "DELETE", headers: auth() });
  if (!r.ok) throw new Error(`Mastodon delete HTTP ${r.status}`);
  return true;
}

module.exports = { post, remove };
