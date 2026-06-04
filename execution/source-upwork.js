// SOURCE: Upwork scraper — find people posting Discord bot building jobs
// Targets: "build bot", "Discord bot", "automation" job postings

async function scrapeUpwork() {
  try {
    const jobs = [];

    // Upwork job search API (public endpoint, no auth required)
    const searchTerms = [
      "discord bot",
      "discord automation",
      "discord bot builder",
      "discord bot development",
    ];

    for (const term of searchTerms) {
      try {
        console.log(`[upwork] searching: "${term}"...`);

        // Upwork public API endpoint for job search
        const response = await fetch(
          `https://www.upwork.com/api/jobs/v2/search?q=${encodeURIComponent(
            term
          )}&sort=recency&status=open`,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
          }
        );

        if (!response.ok) {
          console.log(`[upwork] search "${term}" returned ${response.status}`);
          continue;
        }

        const data = await response.json();

        // Parse job listings
        if (data.jobs && Array.isArray(data.jobs)) {
          for (const job of data.jobs.slice(0, 20)) {
            // Only recent jobs (posted in last 3 days)
            const postedTime = new Date(job.posted_on * 1000);
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

            if (postedTime < threeDaysAgo) continue;

            // High-value indicators: budget mentioned, detailed description
            if (job.budget && job.description && job.description.length > 50) {
              jobs.push({
                text: `${job.title}\n${job.description}`,
                url: `https://www.upwork.com/jobs/${job.key}`,
                author: job.client.display_name || "upwork_client",
                score: job.budget ? parseInt(job.budget.amount) : 0,
                timestamp: job.posted_on,
              });
            }
          }
        }

        // Rate limit
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(`[upwork] term "${term}" error:`, err.message);
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
