// TOOL: Lead Mining Engine — hunt for real prospects across sources
require("dotenv").config();
const Groq = require("groq-sdk");
const { query } = require("./db");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Source scrapers (imported separately)
let sourceFunctions = {};

async function initializeSources() {
  try {
    sourceFunctions = {
      reddit: require("./source-reddit").scrapeReddit,
      github: require("./source-github").scrapeGitHub,
      hackernews: require("./source-hackernews").scrapeHackerNews,
      devto: require("./source-devto").scrapeDevTo,
    };
    console.log("[lead-miner] sources initialized");
  } catch (err) {
    console.error("[lead-miner] source init error:", err.message);
  }
}

async function extractLeadFromText(text, source) {
  try {
    const prompt = `You are a lead qualification AI for InsurgentForge. Extract prospect info from this post/comment.

SOURCE: ${source}
TEXT: ${text.slice(0, 1000)}

Extract if this is a real person looking for Discord bot features/solutions OR talking about bot problems/costs. Return JSON:
{
  "isQualified": true|false,
  "problem": "what bot/feature they need or what problem they mention",
  "currentSolution": "what they're using now (Dyno, MEE6, custom, etc.) or null",
  "painPoints": "why they're interested (cost, missing features, reliability, etc.)",
  "scale": "small/medium/large (estimated users/servers) or unknown",
  "budget": "free/cheap/willing-to-pay/unknown",
  "urgency": "immediate/soon/exploring/unknown",
  "email": "if mentioned, else null",
  "discord": "if mentioned, else null"
}

Qualify if: they mention bot features, problems with current solutions, cost concerns, or custom builds. Don't qualify just for generic tech articles.`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.choices[0]?.message?.content || "";

    try {
      const data = JSON.parse(content);
      return data.isQualified ? data : null;
    } catch (e) {
      // Try to extract JSON from markdown code blocks
      let jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          return data.isQualified ? data : null;
        } catch (e2) {
          // Fall through to regex extraction
        }
      }

      // Try raw JSON extraction
      jsonMatch = content.match(/\{[\s\S]*?\n\}/);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[0]);
          return data.isQualified ? data : null;
        } catch (e3) {
          // Give up
        }
      }
      return null;
    }
  } catch (err) {
    console.error("[lead-miner] extraction error:", err.message);
    return null;
  }
}

async function deduplicateLead(lead, source) {
  try {
    // Check if we've seen this lead before (same problem/person/source combo)
    const { rows } = await query(
      `SELECT id FROM vg_mining_leads
       WHERE source=$1 AND problem_hash=crypt($2, gen_salt('bf'))
       AND created_at > now() - interval '30 days'
       LIMIT 1`,
      [source, lead.problem]
    );

    return rows.length === 0; // true = new lead, false = duplicate
  } catch (err) {
    console.error("[lead-miner] dedup error:", err.message);
    return true; // assume new on error
  }
}

async function storeLead(lead, source, sourceUrl, sourceAuthor) {
  try {
    const { rows } = await query(
      `INSERT INTO vg_mining_leads
       (source, problem, current_solution, pain_points, scale, budget, urgency, email, discord, source_url, source_author)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        source,
        lead.problem,
        lead.currentSolution,
        lead.painPoints,
        lead.scale,
        lead.budget,
        lead.urgency,
        lead.email,
        lead.discord,
        sourceUrl,
        sourceAuthor,
      ]
    );

    return rows[0].id;
  } catch (err) {
    console.error("[lead-miner] storage error:", err.message);
    return null;
  }
}

async function mineSources() {
  try {
    console.log("[lead-miner] starting mining run...");
    await initializeSources();

    const newLeads = [];
    const sources = ["reddit", "github", "hackernews", "devto"];

    for (const source of sources) {
      if (!sourceFunctions[source]) {
        console.log(`[lead-miner] ${source} not ready, skipping`);
        continue;
      }

      try {
        console.log(`[lead-miner] scanning ${source}...`);
        const posts = await sourceFunctions[source]();

        // Filter by recency (past 7 days)
        const sevenDaysAgoSeconds = Math.floor((Date.now() / 1000) - (7 * 24 * 60 * 60));

        for (const post of posts) {
          // Skip if post is older than 7 days
          if (post.timestamp && post.timestamp < sevenDaysAgoSeconds) {
            continue;
          }

          // Extract lead info from text
          const lead = await extractLeadFromText(post.text, source);

          if (lead) {
            // Check if duplicate
            const isNew = await deduplicateLead(lead, source);

            if (isNew) {
              // Store in DB
              const leadId = await storeLead(lead, source, post.url, post.author);
              if (leadId) {
                newLeads.push({
                  id: leadId,
                  source,
                  problem: lead.problem,
                  currentSolution: lead.currentSolution,
                  email: lead.email,
                  discord: lead.discord,
                  sourceUrl: post.url,
                  sourceAuthor: post.author,
                });
                console.log(`[lead-miner] found lead: "${lead.problem}" from ${source}`);
              }
            }
          }
        }
      } catch (err) {
        console.error(`[lead-miner] ${source} error:`, err.message);
        continue;
      }
    }

    console.log(`[lead-miner] mining complete: ${newLeads.length} new leads found`);
    return newLeads;
  } catch (err) {
    console.error("[lead-miner] mining error:", err.message);
    return [];
  }
}

async function getTopLeads(limit = 10) {
  try {
    const { rows } = await query(
      `SELECT * FROM vg_mining_leads
       WHERE delivered_at IS NULL
       ORDER BY
         CASE urgency WHEN 'immediate' THEN 1 WHEN 'soon' THEN 2 ELSE 3 END,
         created_at DESC
       LIMIT $1`,
      [limit]
    );

    return rows;
  } catch (err) {
    console.error("[lead-miner] getTopLeads error:", err.message);
    return [];
  }
}

module.exports = { mineSources, getTopLeads, initializeSources };
