// TOOL: Lead Mining Engine — hunt for real prospects across sources
require("dotenv").config();
const { query } = require("./db");
const { extractLeadSignals } = require("./lead-extractor-simple");

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

function extractLeadFromText(text, source) {
  // Use simple keyword-based extraction (no AI, no token limits)
  return extractLeadSignals(text, source);
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
    // Priority order: customer pain/opportunity sources
    // Note: Upwork & Twitter blocked by anti-bot. Use with paid APIs only.
    const sources = ["fiverr", "indiehackers", "github", "reddit", "hackernews", "devto"];
    // Blocked (require paid API): "upwork", "twitter"

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
