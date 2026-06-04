// TOOL: Content repurposer — turn 1 post into 10 variants for different formats
require("dotenv").config();
const Anthropic = require("@anthropic-ai/sdk");
const { query } = require("./db");

const anthropic = new Anthropic({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

async function repurposeContent(draft) {
  try {
    console.log(`[repurposer] generating variants for "${draft.title}"`);

    const prompt = `You are a content strategist for InsurgentForge. Take this approved post and create 10 different variants optimized for different formats and platforms.

ORIGINAL POST:
Title: ${draft.title}
Topic: ${draft.topic}
Reddit: ${draft.reddit}

Generate ONLY valid JSON with these 10 variants:
{
  "email_subject": "subject line for email (under 50 chars)",
  "email_body": "email body (100-150 words, sales-focused)",
  "linkedin_post": "LinkedIn post (200-250 chars)",
  "twitter_thread": "3-tweet thread (280 chars each, separated by |)",
  "video_script": "60-second video script (200-300 words)",
  "newsletter": "newsletter blurb (150-200 words)",
  "slack_message": "Slack channel post (200 chars)",
  "reddit_comment": "Reddit comment for discussions (150-200 words)",
  "tiktok_script": "15-second TikTok script (100-150 words)",
  "podcast_talking_points": "3-5 bullet points for podcast mentions"
}

Remember:
- Keep the cost-cutting/custom-bot positioning
- No AI clichés
- Different angle/tone for each format
- Actionable value in every variant`;

    const response = await anthropic.messages.create({
      model: "deepseek-chat",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0].type === "text" ? response.content[0].text : "";

    // Parse JSON
    let variants;
    try {
      variants = JSON.parse(content);
    } catch (e) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        variants = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse variants");
      }
    }

    // Store variants
    await query(
      `INSERT INTO vg_content_variants (draft_id, variants, created_at)
       VALUES ($1, $2, now())
       ON CONFLICT (draft_id) DO UPDATE SET variants=$2`,
      [draft.id, JSON.stringify(variants)]
    );

    console.log(`[repurposer] ✅ generated 10 variants for draft ${draft.id}`);
    return variants;
  } catch (err) {
    console.error(`[repurposer] error:`, err.message);
    throw err;
  }
}

async function repurposeApprovedContent() {
  try {
    // Get recently approved content that hasn't been repurposed
    const { rows: drafts } = await query(
      `SELECT d.* FROM vg_content_drafts d
       LEFT JOIN vg_content_variants v ON d.id = v.draft_id
       WHERE d.status='approved' AND v.draft_id IS NULL
       ORDER BY d.approved_at DESC LIMIT 5`,
      []
    );

    if (!drafts.length) {
      console.log(`[repurposer] no new content to repurpose`);
      return [];
    }

    const results = [];
    for (const draft of drafts) {
      try {
        const variants = await repurposeContent(draft);
        results.push({ draft_id: draft.id, variants });
      } catch (err) {
        console.error(`[repurposer] failed for draft ${draft.id}:`, err.message);
      }
    }

    return results;
  } catch (err) {
    console.error(`[repurposer] batch error:`, err.message);
    return [];
  }
}

module.exports = { repurposeApprovedContent, repurposeContent };
