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
      twitter: require("./source-twitter").scrapeTwitter,
      upwork: require("./source-upwork").scrapeUpwork,
      fiverr: require("./source-fiverr").scrapeFiverr,
      indiehackers: require("./source-indiehackers").scrapeIndieHackers,
    };
    console.log("[lead-miner] sources initialized");
  } catch (err) {
    console.error("[lead-miner] source init error:", err.message);
  }
}

async function extractLeadFromText(text, source) {
  try {
    const prompt = `You are a lead qualification AI for InsurgentForge. Find BUSINESS OPPORTUNITIES.

SOURCE: ${source}
TEXT: ${text.slice(0, 1000)}

ONLY qualify if this is a REAL CUSTOMER asking for help OR complaining about cost/pain. Return JSON:
{
  "isQualified": true|false,
  "problem": "what they specifically need (custom bot, cheaper solution, etc)",
  "currentSolution": "what they're using now (paid bot, MEE6, Dyno, etc.) - focus on paid solutions",
  "painPoints": "why this is a problem (too expensive, limited features, too slow, etc.)",
  "scale": "how many servers/users they need (small/medium/large)",
  "budget": "can they pay? (cheap, willing-to-pay, paid-current-solution)",
  "urgency": "how soon do they need this? (immediate/soon/exploring)",
  "email": "if mentioned, else null",
  "discord": "if mentioned, else null"
}

STRICT: Only qualify if:
- They're actively looking for a solution (not just discussing tech)
- They mention cost/pricing problems with current solution
- They need a custom bot built
- They're asking WHO can build/help them

DON'T qualify for:
- Generic tech discussions
- Library bug reports
- How-to tutorials
- Feature discussions with library maintainers`;

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
    // Priority order: customer-direct sources first (job boards, tweets, discussions)
    const sources = ["upwork", "fiverr", "twitter", "indiehackers", "reddit", "github", "hackernews", "devto"];

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
                  current_solution: lead.currentSolution,
                  pain_points: lead.painPoints,
                  scale: lead.scale,
                  budget: lead.budget,
                  urgency: lead.urgency,
                  email: lead.email,
                  discord: lead.discord,
                  source_url: post.url,
                  source_author: post.author,
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
