// SOURCE: Stack Overflow questions about Discord bots
// Monitor unanswered/poorly-answered questions to position yourself as expert

async function scrapeStackOverflow() {
  try {
    const questions = [];

    const searchTerms = [
      "discord bot",
      "discord.py",
      "discord.js",
      "discord automation",
    ];

    for (const term of searchTerms) {
      try {
        console.log(`[stackoverflow] searching: "${term}"...`);

        // Stack Overflow API (public, free)
        const url = `https://api.stackexchange.com/2.3/search/advanced?site=stackoverflow&q=${encodeURIComponent(
          term
        )}&sort=newest&order=desc&pagesize=30`;

        const response = await fetch(url);
        if (!response.ok) continue;

        const data = await response.json();

        if (!data.items) continue;

        for (const item of data.items) {
          // Focus on unanswered or poorly answered questions
          // These are visibility opportunities
          if (
            item.answer_count === 0 ||
            item.score < 2 ||
            item.is_answered === false
          ) {
            questions.push({
              text: `${item.title}\n${item.body || ""}`,
              url: item.link,
              author: item.owner?.display_name || "stackoverflow_user",
              score: item.score,
              timestamp: item.creation_date,
              answers: item.answer_count,
              views: item.view_count,
            });
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`[stackoverflow] search error:`, err.message);
        continue;
      }
    }

    console.log(`[stackoverflow] found ${questions.length} visibility opportunities`);
    return questions;
  } catch (err) {
    console.error("[stackoverflow] scrape error:", err.message);
    return [];
  }
}

module.exports = { scrapeStackOverflow };
