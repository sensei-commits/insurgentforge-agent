// TOOL: Scheduled publisher — check for drafts scheduled to publish at a given time, and publish them.
// Runs periodically (e.g., every 5 min) to catch scheduled posts.
require("dotenv").config();
const { query } = require("./db");
const { publishDraft } = require("./publish");

/**
 * Find drafts that are scheduled to publish NOW (or in the past).
 * Returns array of draft IDs ready to publish.
 */
async function findScheduledPosts() {
  const { rows } = await query(
    `SELECT id, platform, scheduled_publish_at FROM vg_drafts
     WHERE status='pending_approval' AND scheduled_publish_at IS NOT NULL AND scheduled_publish_at <= now()
     ORDER BY scheduled_publish_at ASC`
  );
  return rows;
}

/**
 * Publish a scheduled post. If it fails, leave it as-is (will retry on next cycle).
 */
async function publishScheduled(draftId) {
  try {
    const { url } = await publishDraft(draftId);
    console.log(`[scheduler] published scheduled draft ${draftId} → ${url}`);
    return { success: true, url };
  } catch (err) {
    console.error(`[scheduler] scheduled publish failed for ${draftId}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Run the scheduled publisher cycle.
 */
async function publishScheduledPosts() {
  const scheduled = await findScheduledPosts();
  if (!scheduled.length) return { published: 0 };

  let published = 0;
  for (const draft of scheduled) {
    const result = await publishScheduled(draft.id);
    if (result.success) published++;
  }

  if (published > 0) console.log(`[scheduler] published ${published} scheduled posts.`);
  return { published };
}

module.exports = { findScheduledPosts, publishScheduled, publishScheduledPosts };
