// SOURCE: Quora questions about Discord bots and pricing
// High intent questions: people asking "how much does it cost?" "where to hire?" etc.

async function scrapeQuora() {
  try {
    const questions = [];

    // Quora search URLs for different question types
    const searchTerms = [
      "discord bot builder cost",
      "how to hire discord bot developer",
      "best discord bot service",
      "discord automation tool",
      "discord bot alternatives",
      "how to build a discord bot",
    ];

    for (const term of searchTerms) {
      try {
        console.log(`[quora] searching: "${term}"...`);

        // Quora search - using their web interface
        const url = `https://www.quora.com/search?q=${encodeURIComponent(term)}`;

        const response = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });

        if (!response.ok) continue;

        const html = await response.text();

        // Extract question titles and links from HTML
        // Look for question card patterns
        const questionRegex =
          /<a[^>]*href="\/[^/]+\/[^"]*"[^>]*class="[^"]*question[^"]*"[^>]*>([^<]+)<\/a>/gi;

        let match;
        let count = 0;

        while ((match = questionRegex.exec(html)) !== null && count < 15) {
          const question = match[1];

          if (question && question.length > 10) {
            questions.push({
              text: question,
              url: `https://www.quora.com${match[0].split('href="')[1].split('"')[0]}`,
              author: "quora_user",
              score: 5, // Default - Quora doesn't expose votes easily
              timestamp: Math.floor(Date.now() / 1000),
              source: "quora",
            });
            count++;
          }
        }

        // Alternative: Look for raw question text in page
        if (questions.length === 0) {
          const questionMatches = html.match(/<title>([^<]+) - Quora<\/title>/g);
          if (questionMatches) {
            questionMatches.forEach((q) => {
              const cleanQ = q.replace(/<[^>]+>/g, "").replace(" - Quora", "");
              if (cleanQ.length > 10) {
                questions.push({
                  text: cleanQ,
                  url: url,
                  author: "quora_user",
                  score: 3,
                  timestamp: Math.floor(Date.now() / 1000),
                  source: "quora",
                });
              }
            });
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(`[quora] search error:`, err.message);
        continue;
      }
    }

    console.log(`[quora] found ${questions.length} visibility opportunities`);
    return questions;
  } catch (err) {
    console.error("[quora] scrape error:", err.message);
    return [];
  }
}

module.exports = { scrapeQuora };
