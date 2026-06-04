// TOOL: Visibility Miner - surfaces public questions to answer
// Goal: You answer publicly → build authority → inbound leads follow

require("dotenv").config();
const { query } = require("./db");
const { scrapeStackOverflow } = require("./source-stackoverflow");
const { scrapeQuora } = require("./source-quora");

async function mineVisibilityOpportunities() {
  try {
    console.log("[visibility] starting opportunity scan...");

    const opportunities = [];

    // Scan Stack Overflow
    try {
      console.log("[visibility] scanning Stack Overflow...");
      const soQuestions = await scrapeStackOverflow();
      opportunities.push(
        ...soQuestions.map((q) => ({
          ...q,
          source: "stackoverflow",
          type: "unanswered_question",
          priority:
            q.answer_count === 0
              ? "high"
              : q.views > 1000 && q.answer_count < 3
              ? "medium"
              : "low",
        }))
      );
    } catch (err) {
      console.error("[visibility] Stack Overflow error:", err.message);
    }

    // Scan Quora
    try {
      console.log("[visibility] scanning Quora...");
      const quoraQuestions = await scrapeQuora();
      opportunities.push(
        ...quoraQuestions.map((q) => ({
          ...q,
          source: "quora",
          type: "buying_question",
          priority: "high", // Quora questions = people actively looking for solutions
        }))
      );
    } catch (err) {
      console.error("[visibility] Quora error:", err.message);
    }

    // Filter for relevance
    const filtered = opportunities
      .filter(
        (opp) =>
          opp.text &&
          (opp.text.toLowerCase().includes("discord") ||
            opp.text.toLowerCase().includes("bot") ||
            opp.text.toLowerCase().includes("automation"))
      )
      .filter((opp) => opp.priority !== "low") // Only high/medium priority
      .filter((opp) => !opp.text.includes("test")); // Filter out spam

    // Sort by priority and relevance
    filtered.sort((a, b) => {
      const priorityScore = {
        high: 3,
        medium: 2,
        low: 1,
      };
      return priorityScore[b.priority] - priorityScore[a.priority];
    });

    console.log(
      `[visibility] found ${filtered.length} visibility opportunities`
    );

    return filtered.slice(0, 20); // Return top 20
  } catch (err) {
    console.error("[visibility] mining error:", err.message);
    return [];
  }
}

module.exports = { mineVisibilityOpportunities };
