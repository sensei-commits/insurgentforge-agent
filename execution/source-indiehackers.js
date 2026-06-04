// SOURCE: Indie Hackers scraper — find founders discussing bot/automation services
// Targets: discussions about building bot services, automation problems, pricing

async function scrapeIndieHackers() {
  try {
    const discussions = [];

    // Indie Hackers search queries
    const searchTerms = [
      "discord bot service",
      "bot automation business",
      "discord automation",
      "paid bot service",
      "custom automation",
    ];

    for (const term of searchTerms) {
      try {
        console.log(`[indiehackers] searching: "${term}"...`);

        // Indie Hackers doesn't have an official API, but their GraphQL endpoint is accessible
        // Search using their community search endpoint
        const response = await fetch(
          `https://www.indiehackers.com/search?q=${encodeURIComponent(term)}&type=posts`,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          console.log(`[indiehackers] search returned ${response.status}`);
          continue;
        }

        const html = await response.text();

        // Parse HTML to extract discussion links and metadata
        // Look for post titles and links
        const postRegex =
          /<a[^>]*href="([^"]*)"[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/a>/gi;
        let match;

        while ((match = postRegex.exec(html)) !== null) {
          const url = match[1];
          const title = match[2];

          // Only include discussions from IndieHackers
          if (url.includes("indiehackers.com")) {
            discussions.push({
              text: `${title}`,
              url: `https://www.indiehackers.com${url}`,
              author: "indiehackers_user",
              score: 5, // Default score for discussions
              timestamp: Math.floor(Date.now() / 1000),
            });
          }
        }

        // Rate limit
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (err) {
        console.error(
          `[indiehackers] search "${term}" error:`,
          err.message
        );
        continue;
      }
    }

    console.log(
      `[indiehackers] found ${discussions.length} relevant discussions`
    );
    return discussions;
  } catch (err) {
    console.error("[indiehackers] scrape error:", err.message);
    return [];
  }
}

module.exports = { scrapeIndieHackers };
