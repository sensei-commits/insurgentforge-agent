// STRICT lead extraction - only REAL customer opportunities
// Filters out noise, focuses on actionable leads

function extractStrictLead(text, source) {
  try {
    // For job board posts: almost all are qualified leads
    if (source === "upwork" || source === "freelancer") {
      // Job postings are inherently customer leads
      const problem = text.split("\n")[0].slice(0, 150);

      return {
        isQualified: true,
        problem,
        currentSolution: "possibly existing bot or manual work",
        painPoints: "needs custom Discord bot solution",
        scale: "unknown",
        budget: "willing-to-pay", // They posted a job = money available
        urgency: "soon", // Job posting = active need
        email: null,
        discord: null,
      };
    }

    const lowerText = text.toLowerCase();

    // STRICT customer signals only
    // These must be REAL customer requests, not discussions

    // Pattern 1: "Build me a bot" / "I need a bot" / "Can someone..."
    const directRequest =
      /\b(build|create|develop|make|code|hire|need|looking for|can (you|someone|anyone))\b.*\b(bot|automation|discord|integration)\b/i;

    // Pattern 2: Active job/service posting
    const jobPosting =
      /\b(looking for|hiring|need|want|seeking)\b.*\b(developer|builder|coder|freelancer|contractor)\b.*\b(bot|automation|discord)\b/i;

    // Pattern 3: Competitor pain - mentions paying for something expensive
    const competitorPain =
      /\b(MEE6|Dyno|UnbelievaBoat|Mantaro|JoinMessage|Wick)\b.*\b(too.*expensive|too.*costly|too.*much|overpriced|expensive|paying|cost|price)\b/i;

    // Pattern 4: Explicit budget/payment mention
    const hasBudget =
      /\b(budget|price|cost|paying|willing to pay|hourly|per.*hour|flat.*rate|\$|\d+)\b/i;

    // Require at least 2 strong signals
    let signalCount = 0;
    if (directRequest.test(lowerText)) signalCount++;
    if (jobPosting.test(lowerText)) signalCount++;
    if (competitorPain.test(lowerText)) signalCount++;
    if (hasBudget.test(lowerText)) signalCount++;

    // Must have minimum 2 signals to be a real lead
    if (signalCount < 2) {
      return null;
    }

    // Extract problem from title/first line
    const lines = text.split("\n");
    let problem = lines[0].slice(0, 150);
    if (problem.length > 140) problem += "...";

    // Detect urgency
    let urgency = "soon";
    if (lowerText.includes("urgent") || lowerText.includes("asap")) {
      urgency = "immediate";
    }

    // Detect budget
    let budget = "willing-to-pay";
    const budgetMatch = lowerText.match(/\$(\d+)/);
    if (budgetMatch) {
      budget = `$${budgetMatch[1]}+`;
    }

    return {
      isQualified: true,
      problem,
      currentSolution: competitorPain.test(lowerText)
        ? "expensive competitor bot"
        : "manual or existing solution",
      painPoints: "needs custom Discord bot",
      scale: "unknown",
      budget,
      urgency,
      email: null,
      discord: null,
    };
  } catch (err) {
    return null;
  }
}

module.exports = { extractStrictLead };
