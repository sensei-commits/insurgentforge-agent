// TOOL: Daily content generator — creates bot-focused posts about capabilities & cost-cutting.
const Anthropic = require("@anthropic-ai/sdk");
const { query } = require("./db");

const anthropic = new Anthropic({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

const BOT_TOPICS = [
  "Discord moderation bots and rule automation",
  "Custom bot reaction handlers and emoji automation",
  "Bot message filtering and content moderation",
  "Discord role assignment bots and permission management",
  "Custom bot logging and audit trails",
  "Discord server backup and recovery bots",
  "Custom bot welcome sequences and onboarding",
  "Bot-powered ticket systems and support automation",
  "Custom bot leveling and gamification systems",
  "Discord bot analytics and server insights",
  "Custom bot music streaming alternatives",
  "Bot-powered economy systems and virtual currency",
  "Discord scheduling and reminder bots",
  "Custom bot Reddit/social media integrations",
  "Bot anti-spam and raid protection",
];

async function generateDailyContent() {
  try {
    // Pick a random topic
    const topic = BOT_TOPICS[Math.floor(Math.random() * BOT_TOPICS.length)];
    console.log(`[content] generating post for topic: "${topic}"`);

    // Get recent post titles to avoid repeats
    const { rows: recentPosts } = await query(
      `SELECT title FROM vg_content_drafts
       WHERE created_at > now() - interval '30 days'
       ORDER BY created_at DESC LIMIT 50`,
      []
    );
    const recentTitles = recentPosts.map((r) => r.title);

    // Generate post idea
    const prompt = `You are InsurgentForge, a Discord bot automation expert. Your business is building custom Discord bots that replace expensive paid solutions with cheaper, better alternatives.

Your job: Write a single, engaging post about this bot capability:
"${topic}"

The post should:
1. Highlight what this bot capability does
2. Explain why custom bots beat expensive paid solutions (cost, flexibility, features)
3. Use casual, friendly tone (sound like a real builder, not marketing)
4. NO how-to guides - position the capability, not teach people to build
5. NO hashtag spam
6. Anchor to: Build. Forge. Empower. (but naturally, not forced)

Recent post titles to AVOID repeating:
${recentTitles.slice(0, 10).map((t) => `- ${t}`).join("\n")}

Generate a post with:
- "title": 1-line post title (no hashtags)
- "reddit": Reddit post (r/Discord_Bots style, ~100-200 words)
- "bluesky": Bluesky post (280 chars max)
- "mastodon": Mastodon post (500 chars max)
- "devto": Dev.to article title + first 300 chars of body
- "twitter_draft": Twitter post for copy/paste (~280 chars)
- "linkedin_draft": LinkedIn post for copy/paste (~300 chars)

Return ONLY valid JSON, no markdown.`;

    const response = await anthropic.messages.create({
      model: "deepseek-chat",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0].type === "text" ? response.content[0].text : "";

    // Parse JSON from response
    let draft;
    try {
      draft = JSON.parse(content);
    } catch (e) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        draft = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error("Could not parse JSON from response");
      }
    }

    // Validate draft has required fields
    const required = ["title", "reddit", "bluesky", "mastodon", "devto", "twitter_draft", "linkedin_draft"];
    const missing = required.filter((f) => !draft[f]);
    if (missing.length > 0) {
      throw new Error(`Missing fields: ${missing.join(", ")}`);
    }

    // Check for duplicates (exact title match in last 30 days)
    const { rows: dupes } = await query(
      `SELECT id FROM vg_content_drafts WHERE title = $1 AND created_at > now() - interval '30 days'`,
      [draft.title]
    );
    if (dupes.length > 0) {
      console.log(`[content] ⚠️ duplicate title detected, regenerating...`);
      // Recursive call to regenerate (max 3 attempts to avoid infinite loop)
      return generateDailyContent();
    }

    // Store in database
    const { rows } = await query(
      `INSERT INTO vg_content_drafts (topic, title, reddit, bluesky, mastodon, devto, twitter_draft, linkedin_draft, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       RETURNING id, title, created_at`,
      [
        topic,
        draft.title,
        draft.reddit,
        draft.bluesky,
        draft.mastodon,
        draft.devto,
        draft.twitter_draft,
        draft.linkedin_draft,
        "pending_approval",
      ]
    );

    console.log(`[content] ✅ generated draft ${rows[0].id}: "${draft.title}"`);
    return rows[0];
  } catch (err) {
    console.error(`[content] generation error:`, err.message);
    throw err;
  }
}

module.exports = { generateDailyContent };
