// TOOL: Simple keyword-based lead extraction (no AI)
// Extracts lead signals without using Groq API

function extractLeadSignals(text, source) {
  try {
    // CUSTOMER PAIN KEYWORDS - high intent signals
    const painKeywords = [
      "expensive",
      "too costly",
      "paying too much",
      "overpriced",
      "broke",
      "broken",
      "doesn't work",
      "frustrat",
      "annoying",
      "limit",
      "capped",
      "quota",
      "downtime",
      "outage",
    ];

    // CUSTOMER NEED KEYWORDS - direct requests
    const needKeywords = [
      "looking for",
      "need help",
      "can anyone",
      "does anyone",
      "help wanted",
      "for hire",
      "custom bot",
      "build",
      "develop",
      "create",
      "alternative",
      "replace",
      "switch from",
    ];

    // PAID SOLUTION KEYWORDS - they're willing to pay
    const paidKeywords = [
      "paid",
      "premium",
      "subscription",
      "license",
      "pricing",
      "cost",
      "budget",
      "invest",
      "spending",
      "hire",
      "contract",
    ];

    // COMPETITOR KEYWORDS - specific pain points
    const competitorKeywords = [
      "MEE6",
      "Dyno",
      "UnbelievaBoat",
      "JoinMessage",
      "Wick",
      "Mantaro",
    ];

    const lowerText = text.toLowerCase();

    // Score based on keyword matches
    let painScore = 0;
    let needScore = 0;
    let paidScore = 0;
    let competitorScore = 0;

    painKeywords.forEach((kw) => {
      if (lowerText.includes(kw)) painScore += 5;
    });

    needKeywords.forEach((kw) => {
      if (lowerText.includes(kw)) needScore += 5;
    });

    paidKeywords.forEach((kw) => {
      if (lowerText.includes(kw)) paidScore += 3;
    });

    competitorKeywords.forEach((kw) => {
      if (lowerText.includes(kw)) competitorScore += 10;
    });

    const totalScore = painScore + needScore + paidScore + competitorScore;

    // QUALIFY if: clear pain + need, OR mentions paid solution + need, OR mentions competitor + pain
    const isQualified =
      (painScore >= 5 && needScore >= 5) || // Pain + need
      (competitorScore >= 10 && needScore >= 5) || // Competitor complaint + need
      (paidScore >= 6 && needScore >= 5); // Paid solution + need

    if (!isQualified) {
      return null;
    }

    // Extract problem statement (first 150 chars)
    let problem = text.slice(0, 150);
    if (problem.length > 140) problem += "...";

    // Detect urgency
    let urgency = "exploring";
    if (text.toLowerCase().includes("urgent") || text.includes("ASAP")) {
      urgency = "immediate";
    } else if (needScore >= 10) {
      urgency = "soon";
    }

    // Detect budget level
    let budget = "unknown";
    if (paidScore >= 10) {
      budget = "willing-to-pay";
    } else if (text.toLowerCase().includes("cheap") || text.includes("free")) {
      budget = "cheap";
    }

    return {
      isQualified: true,
      problem,
      currentSolution: null,
      painPoints: painScore > 0 ? "cost/limitation concerns" : null,
      scale: "unknown",
      budget,
      urgency,
      email: null,
      discord: null,
      confidence: Math.min(100, (totalScore / 40) * 100), // 0-100 confidence
    };
  } catch (err) {
    return null;
  }
}

module.exports = { extractLeadSignals };
