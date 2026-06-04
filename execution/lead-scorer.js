// TOOL: Lead scorer — analyzes emails for buying signals, ranks conversion likelihood
require("dotenv").config();
const Anthropic = require("@anthropic-ai/sdk");
const { query } = require("./db");

const anthropic = new Anthropic({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

// High-value keywords that signal buying intent
const BUYING_SIGNALS = {
  budget: /budget|pricing|cost|price|afford|expensive|cheap/i,
  need: /need|require|looking for|want|must have|critical/i,
  problem: /issue|problem|broken|failing|not working|lag|slow/i,
  competitor: /dyno|mee6|paid|subscription|premium|upgrade/i,
  timeline: /asap|urgent|immediately|this week|this month|deadline/i,
  scale: /1000|10k|100k|million|large|enterprise|scale/i,
};

async function scoreEmail(subject, body, from) {
  try {
    const prompt = `You are a sales intelligence AI for InsurgentForge (custom Discord bots that replace expensive paid solutions).

Analyze this email for buying intent and conversion likelihood:

FROM: ${from}
SUBJECT: ${subject}
BODY: ${body.slice(0, 500)}

Score this person on a scale of 0-100 based on:
1. **Buying Intent** (are they looking to solve a problem they'll pay for?)
2. **Urgency** (how soon do they need a solution?)
3. **Budget** (do they have money? are they price-sensitive?)
4. **Technical Fit** (is their problem something a custom Discord bot solves?)
5. **Competitor Signal** (are they frustrated with existing paid bots?)

Return ONLY valid JSON:
{
  "score": 0-100,
  "intent": "high|medium|low",
  "urgency": "urgent|soon|flexible",
  "budget": "high|medium|low|unknown",
  "problem": "description of their problem",
  "fit": "strong|good|weak",
  "reasoning": "1-2 sentence why this score"
}`;

    const response = await anthropic.messages.create({
      model: "deepseek-chat",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0].type === "text" ? response.content[0].text : "";

    // Parse JSON
    let score;
    try {
      score = JSON.parse(content);
    } catch (e) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        score = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse JSON from response");
      }
    }

    return score;
  } catch (err) {
    console.error(`[lead-scorer] scoring error:`, err.message);
    return null;
  }
}

async function analyzeIncomingEmails() {
  try {
    const { rows: unscored } = await query(
      `SELECT * FROM gmail_messages WHERE lead_score IS NULL ORDER BY received_at DESC LIMIT 20`,
      []
    );

    if (!unscored.length) {
      console.log(`[lead-scorer] no new emails to score`);
      return [];
    }

    const leads = [];

    for (const email of unscored) {
      const score = await scoreEmail(email.subject, email.body || "", email.from);

      if (score) {
        // Store score
        await query(
          `UPDATE gmail_messages
           SET lead_score=$1, lead_intent=$2, lead_problem=$3, lead_fit=$4
           WHERE id=$5`,
          [score.score, score.intent, score.problem, score.fit, email.id]
        );

        // Only flag high-value leads
        if (score.score >= 70) {
          leads.push({
            from: email.from,
            subject: email.subject,
            score: score.score,
            intent: score.intent,
            problem: score.problem,
            urgency: score.urgency,
            reasoning: score.reasoning,
          });
        }

        console.log(`[lead-scorer] scored "${email.subject}" from ${email.from}: ${score.score}`);
      }
    }

    return leads;
  } catch (err) {
    console.error(`[lead-scorer] analysis error:`, err.message);
    return [];
  }
}

module.exports = { analyzeIncomingEmails };
