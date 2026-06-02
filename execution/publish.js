// TOOL: publish a stored draft to its platform, then record the result.
// Called by the approval bot when the owner taps ✅. Reusable + testable.
require("dotenv").config();
const { query } = require("./db");
const bsky = require("./publishers/bluesky");
const masto = require("./publishers/mastodon");
const devto = require("./publishers/devto");

function deriveTags(draft) {
  // simple, relevant Dev.to tags
  const tags = ["discord", "bots"];
  const t = `${draft.title} ${draft.body}`.toLowerCase();
  if (t.includes("javascript") || t.includes("discord.js")) tags.push("javascript");
  else if (t.includes("python")) tags.push("python");
  else tags.push("programming");
  return tags.slice(0, 4);
}

/**
 * Publish a draft by id. Routes to the right platform publisher, updates vg_drafts.
 * @returns { url, platform }
 */
async function publishDraft(draftId) {
  const { rows } = await query(`SELECT * FROM vg_drafts WHERE id=$1`, [draftId]);
  if (!rows.length) throw new Error("draft not found");
  const d = rows[0];

  if (d.status === "published") return { url: d.published_url, platform: d.platform, already: true };
  if (d.refusal && d.refusal.blocked) throw new Error("draft is blocked by refusal gate");

  let url;
  switch (d.platform) {
    case "bluesky":
      url = (await bsky.post(d.body)).url;
      break;
    case "mastodon":
      url = (await masto.post(d.body)).url;
      break;
    case "devto":
      url = (await devto.post({ title: d.title || "Untitled", body: d.body, tags: deriveTags(d), published: true })).url;
      break;
    case "reddit":
      throw new Error("Reddit is not connected yet (deferred). Cannot publish.");
    default:
      throw new Error(`Platform '${d.platform}' is paste-only — publish manually.`);
  }

  await query(
    `UPDATE vg_drafts SET status='published', published_at=now(), published_url=$2 WHERE id=$1`,
    [draftId, url]
  );
  return { url, platform: d.platform };
}

async function rejectDraft(draftId) {
  await query(`UPDATE vg_drafts SET status='rejected' WHERE id=$1`, [draftId]);
  return true;
}

module.exports = { publishDraft, rejectDraft };
