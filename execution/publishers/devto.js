// TOOL: Dev.to publisher. post() creates an article; supports draft mode (published:false)
// for safe verification. Dev.to has no delete-via-API, so we verify using drafts only.
require("dotenv").config();

const API = "https://dev.to/api";

/**
 * Publish (or draft) an article.
 * @param {object} a
 * @param {string} a.title
 * @param {string} a.body      markdown
 * @param {string[]} a.tags    up to 4 tags
 * @param {boolean} a.published  true=live, false=draft (safe)
 * @returns { url, id, published }
 */
async function post({ title, body, tags = [], published = false }) {
  const r = await fetch(`${API}/articles`, {
    method: "POST",
    headers: { "api-key": process.env.DEVTO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      article: {
        title: title.slice(0, 250),
        body_markdown: body,
        published,
        tags: tags.slice(0, 4),
      },
    }),
  });
  if (!r.ok) throw new Error(`Dev.to post HTTP ${r.status} ${(await r.text()).slice(0, 250)}`);
  const d = await r.json();
  return { url: d.url, id: d.id, published: d.published };
}

/** Unpublish/convert to draft (best-effort cleanup for verification). */
async function unpublish(id) {
  const r = await fetch(`${API}/articles/${id}`, {
    method: "PUT",
    headers: { "api-key": process.env.DEVTO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ article: { published: false } }),
  });
  return r.ok;
}

module.exports = { post, unpublish };
