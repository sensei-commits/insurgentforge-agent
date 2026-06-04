// TOOL: Competitor tracker — monitors market for threats and opportunities
require("dotenv").config();
const Anthropic = require("@anthropic-ai/sdk");
const { query } = require("./db");

const anthropic = new Anthropic({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

// Competitors to track
const COMPETITORS = ["Dyno", "MEE6", "UnbelievaBoat", "Tatsumaki", "Ticket Tool", "Statbot"];

// Simulated market intelligence (in production, would scrape Reddit, Twitter, HN)
async function getMarketSignals() {
  return [
    {
      source: "reddit",
      subreddit: "r/Discord_Bots",
      title: "MEE6 raising prices again - looking for alternatives",
      sentiment: "negative",
      mentions: ["MEE6", "expensive", "looking for cheaper"],
      url: "https://reddit.com/r/Discord_Bots/example1",
    },
    {
      source: "reddit",
      subreddit: "r/discordapp",
      title: "Dyno bot keeps timing out on permissions",
      sentiment: "negative",
      mentions: ["Dyno", "broken", "support is bad"],
      url: "https://reddit.com/r/discordapp/example2",
    },
    {
      source: "twitter",
      author: "@discorddev",
      text: "New discord.js features make custom bots easier than ever",
      sentiment: "neutral",
      mentions: ["discord.js", "custom bots"],
      url: "https://twitter.com/discorddev/example",
    },
  ];
}

async function analyzeSignal(signal) {
  try {
    const prompt = `You are a competitive intelligence AI for InsurgentForge.

Analyze this market signal:
SOURCE: ${signal.source}
TITLE/TEXT: ${signal.title || signal.text}
MENTIONS: ${signal.mentions.join(", ")}
URL: ${signal.url}

Rate this as an opportunity for InsurgentForge:
- Is this a threat (competitor gaining traction)?
- Is this an opportunity (customer pain point we can solve)?
- What should we do about it?

Return ONLY valid JSON:
{
  "type": "threat|opportunity|neutral",
  "confidence": 0-100,
  "insight": "1-2 sentence what this means",
  "action": "what InsurgentForge should do about this"
}`;

    const response = await anthropic.messages.create({
      model: "deepseek-chat",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0].type === "text" ? response.content[0].text : "";

    // Parse JSON
    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch (e) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse JSON");
      }
    }

    return analysis;
  } catch (err) {
    console.error(`[competitor-tracker] analysis error:`, err.message);
    return null;
  }
}

async function trackCompetitors() {
  try {
    console.log(`[competitor-tracker] scanning market signals...`);
    const signals = await getMarketSignals();

    const alerts = [];

    for (const signal of signals) {
      const analysis = await analyzeSignal(signal);

      if (analysis && analysis.confidence >= 70) {
        // Store in database
        await query(
          `INSERT INTO vg_market_signals (source, title, sentiment, type, confidence, insight, url, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, now())
           ON CONFLICT DO NOTHING`,
          [
            signal.source,
            signal.title || signal.text,
            signal.sentiment,
            analysis.type,
            analysis.confidence,
            analysis.insight,
            signal.url,
          ]
        );

        if (analysis.type !== "neutral") {
          alerts.push({
            type: analysis.type,
            title: signal.title || signal.text,
            source: signal.source,
            confidence: analysis.confidence,
            insight: analysis.insight,
            action: analysis.action,
          });
        }

        console.log(
          `[competitor-tracker] ${analysis.type.toUpperCase()}: "${signal.title || signal.text}" (${analysis.confidence}%)`
        );
      }
    }

    return alerts;
  } catch (err) {
    console.error(`[competitor-tracker] tracking error:`, err.message);
    return [];
  }
}

module.exports = { trackCompetitors };
