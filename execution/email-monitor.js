// TOOL: Email monitor — fetch social media interaction emails from Gmail, summarize, ping Discord.
require("dotenv").config();
const { fetchEmails, markAsRead } = require("./gmail-client");
const { think } = require("./ai");
const { postToTrends } = require("./discord");

// Keywords that indicate important social media interactions
const KEYWORDS = {
  follower: /new follower|followed you|started following|subscriber/i,
  like: /liked your|like your post|♥|❤️/i,
  comment: /commented on|comment on your/i,
  reply: /replied to|reply to your/i,
  mention: /mentioned you|@mentioned|tagged you/i,
  retweet: /retweeted|retweet|shared your/i,
  interaction: /engagement|interaction|activity|update/i,
};

function classifyEmail(subject, from) {
  const text = `${subject} ${from}`.toLowerCase();
  for (const [type, pattern] of Object.entries(KEYWORDS)) {
    if (pattern.test(text)) return type;
  }
  return null;
}

function isSocialMediaEmail(subject, from) {
  // Filter for known social platforms
  const socialPatterns = [
    /twitter|x\.com|@twitter/i,
    /instagram|@instagram/i,
    /bluesky|bsky\.social/i,
    /mastodon/i,
    /linkedin/i,
    /follower|subscriber|new user/i, // generic interaction keywords
  ];

  const text = `${subject} ${from}`;
  return socialPatterns.some((p) => p.test(text));
}

/**
 * Monitor Gmail for new social media interaction emails.
 * Returns array of { from, subject, type, summary }.
 */
async function monitorEmails() {
  try {
    // Fetch unread emails from last 24 hours
    const messages = await fetchEmails(`is:unread newer_than:1d`, 20);
    if (!messages.length) return [];

    const interactions = [];

    for (const msg of messages) {
      const headers = msg.payload.headers || [];
      const subject = headers.find((h) => h.name === "Subject")?.value || "(no subject)";
      const from = headers.find((h) => h.name === "From")?.value || "(unknown)";

      // Check if it's a social media interaction
      if (!isSocialMediaEmail(subject, from)) continue;

      const type = classifyEmail(subject, from);
      if (!type) continue;

      // Summarize using AI
      let summary;
      try {
        const { text } = await think({
          system:
            "You are Vanguard. Summarize this social media interaction email in 1 sentence, focusing on the action and who did it. Be concise.",
          prompt: `Email: From: ${from}\nSubject: ${subject}`,
          maxTokens: 50,
          temperature: 0.7,
        });
        summary = text.trim();
      } catch {
        summary = subject; // fallback
      }

      interactions.push({
        id: msg.id,
        from,
        subject,
        type,
        summary,
      });

      // Mark as read so we don't re-process
      await markAsRead(msg.id).catch(() => {});
    }

    return interactions;
  } catch (err) {
    console.error("[email-monitor] Error:", err.message);
    return [];
  }
}

/**
 * Post interaction summaries to Discord #trends.
 */
async function deliverInteractions(interactions) {
  if (!interactions.length) return;

  const embed = {
    title: `📧 New Social Media Interactions (${interactions.length})`,
    description: interactions.map((i) => `**${i.type}** — ${i.summary}`).join("\n"),
    color: 0xffa500, // orange
    footer: { text: "Vanguard Email Monitor" },
    timestamp: new Date().toISOString(),
  };

  await postToTrends({ embeds: [embed], content: `<@${process.env.DISCORD_OWNER_ID}> 📧 check your social interactions!` });
}

module.exports = { monitorEmails, deliverInteractions };
