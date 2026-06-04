// SOURCE: Stack Overflow questions about Discord bots
// Scrape the search results page directly (simpler than API)

async function scrapeStackOverflow() {
  try {
    const questions = [];

    const searchTerms = [
      "discord bot",
      "discord.py",
      "discord.js",
    ];

    for (const term of searchTerms) {
      try {
        console.log(`[stackoverflow] searching: "${term}"...`);

        // Direct web scrape (easier than API)
        const url = `https://stackoverflow.com/search?q=${encodeURIComponent(
          term
        )}&tab=newest`;

        const response = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });

        if (!response.ok) {
          console.log(`[stackoverflow] status ${response.status}`);
          continue;
        }

        const html = await response.text();

        // Extract questions from page
        // Look for question links and titles
        const questionRegex =
          /<a[^>]*class="[^"]*s-link[^"]*"[^>]*href="\/questions\/(\d+)\/([^"]*)"[^>]*>([^<]+)<\/a>/gi;

        let match;
        let count = 0;

        while ((match = questionRegex.exec(html)) !== null && count < 10) {
          const questionId = match[1];
          const questionSlug = match[2];
          const questionTitle = match[3];

          if (questionTitle && questionTitle.length > 10) {
            questions.push({
              text: questionTitle,
              url: `https://stackoverflow.com/questions/${questionId}/${questionSlug}`,
              author: "stackoverflow_user",
              score: 0, // Would need to scrape each page for score
              timestamp: Math.floor(Date.now() / 1000),
              answers: 0,
              views: 0,
            });
            count++;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (err) {
        console.log(`[stackoverflow] search error: ${err.message}`);
        continue;
      }
    }

    console.log(`[stackoverflow] found ${questions.length} unanswered questions`);
    return questions;
  } catch (err) {
    console.error("[stackoverflow] scrape error:", err.message);
    return [];
  }
}

module.exports = { scrapeStackOverflow };
