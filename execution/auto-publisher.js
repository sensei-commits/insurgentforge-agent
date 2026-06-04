// TOOL: Auto-publish approved content drafts to Bluesky, Mastodon, Dev.to
const fetch = require("node-fetch");

// Bluesky
async function publishToBluesky(text) {
  try {
    const response = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: process.env.BLUESKY_HANDLE,
        password: process.env.BLUESKY_APP_PASSWORD,
      }),
    });
    const session = await response.json();

    const postResponse = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessJwt}`,
      },
      body: JSON.stringify({
        repo: session.did,
        collection: "app.bsky.feed.post",
        record: {
          text,
          createdAt: new Date().toISOString(),
        },
      }),
    });

    const result = await postResponse.json();
    console.log(`[publisher] 🦋 Posted to Bluesky: ${result.uri}`);
    return { platform: "Bluesky", url: result.uri };
  } catch (err) {
    console.error(`[publisher] Bluesky error:`, err.message);
    throw err;
  }
}

// Mastodon
async function publishToMastodon(text) {
  try {
    const response = await fetch(`${process.env.MASTODON_INSTANCE_URL}/api/v1/statuses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MASTODON_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ status: text }),
    });

    const result = await response.json();
    console.log(`[publisher] 🐘 Posted to Mastodon: ${result.url}`);
    return { platform: "Mastodon", url: result.url };
  } catch (err) {
    console.error(`[publisher] Mastodon error:`, err.message);
    throw err;
  }
}

// Dev.to
async function publishToDevTo(title, body) {
  try {
    const response = await fetch("https://dev.to/api/articles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.DEVTO_API_KEY,
      },
      body: JSON.stringify({
        article: {
          title,
          body_markdown: body,
          published: true,
          tags: ["discord", "bots", "automation"],
        },
      }),
    });

    const result = await response.json();
    console.log(`[publisher] 📝 Posted to Dev.to: ${result.url}`);
    return { platform: "Dev.to", url: result.url };
  } catch (err) {
    console.error(`[publisher] Dev.to error:`, err.message);
    throw err;
  }
}

// Publish to all platforms
async function publishDraftToAll(draft) {
  const results = [];

  try {
    const bsky = await publishToBluesky(draft.bluesky);
    results.push(bsky);
  } catch (e) {
    console.error("[publisher] Bluesky failed:", e.message);
  }

  try {
    const mastodon = await publishToMastodon(draft.mastodon);
    results.push(mastodon);
  } catch (e) {
    console.error("[publisher] Mastodon failed:", e.message);
  }

  try {
    const devto = await publishToDevTo(draft.title, draft.devto);
    results.push(devto);
  } catch (e) {
    console.error("[publisher] Dev.to failed:", e.message);
  }

  return results;
}

module.exports = { publishDraftToAll };
