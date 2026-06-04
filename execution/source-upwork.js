// SOURCE: Upwork scraper — find people posting Discord bot building jobs
// Web scraping approach (no API key needed)

async function scrapeUpwork() {
  try {
    const jobs = [];

    const searchTerms = ["discord bot", "discord automation", "bot development"];

    for (const term of searchTerms) {
      try {
        console.log(`[upwork] searching: "${term}"...`);

        // Upwork jobs search page
        const url = `https://www.upwork.com/ab/jobs/search/?q=${encodeURIComponent(
          term
        )}&sort=recency`;

        const response = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });

        if (!response.ok) {
          console.log(`[upwork] returned ${response.status}`);
          continue;
        }

        const html = await response.text();

        // Extract job data from page
        // Parse recent job postings (last 3 days)
        const jobMatches = html.match(
          /"job":\s*\{[^}]*"title":\s*"([^"]*)"[^}]*"description":\s*"([^"]*)"[^}]*"budget":\s*([0-9.]+)[^}]*"postedOn":\s*"([^"]*)"/g
        );

        if (jobMatches) {
          for (const jobMatch of jobMatches.slice(0, 20)) {
            try {
              const titleMatch = jobMatch.match(/"title":\s*"([^"]*)"/);
              const descMatch = jobMatch.match(/"description":\s*"([^"]*)"/);
              const budgetMatch = jobMatch.match(/"budget":\s*([0-9.]+)/);
              const dateMatch = jobMatch.match(/"postedOn":\s*"([^"]*)"/);

              if (titleMatch && descMatch && budgetMatch) {
                jobs.push({
                  text: `${titleMatch[1]}\n${descMatch[1]}`,
                  url: `https://www.upwork.com/jobs/search`,
                  author: "upwork_client",
                  score: parseInt(budgetMatch[1]) || 500,
                  timestamp: Math.floor(Date.now() / 1000),
                });
              }
            } catch (e) {
              continue;
            }
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (err) {
        console.error(`[upwork] search error:`, err.message);
        continue;
      }
    }

    console.log(`[upwork] found ${jobs.length} relevant job postings`);
    return jobs;
  } catch (err) {
    console.error("[upwork] scrape error:", err.message);
    return [];
  }
}

module.exports = { scrapeUpwork };
