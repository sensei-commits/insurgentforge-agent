// SOURCE: Dev.to scraper — hunt for Discord/bot building discussions

async function fetchDevTo(path) {
  try {
    const response = await fetch(`https://dev.to/api${path}`, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Dev.to returned ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    throw new Error(`Dev.to fetch failed: ${err.message}`);
  }
}

async function scrapeDevTo() {
  try {
    const posts = [];

    // Search for business/service signals, not tutorials
    // Look for people offering services, asking for help, or discussing pain points
    const tags = ["freelance", "hiring", "jobs", "for-hire"];

    for (const tag of tags) {
      try {
        console.log(`[devto] searching tag: ${tag}...`);

        // Get articles published in the past 7 days
        const response = await fetchDevTo(`/articles?tag=${tag}&per_page=30&sort=-published_at&top=7d`);

        if (!Array.isArray(response)) continue;

        for (const article of response.slice(0, 20)) {
          // Filter for articles published in the past 7 days
          const pubDate = new Date(article.published_at);
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

          if (pubDate < sevenDaysAgo) continue;

          // Look for high-engagement articles
          if (article.comments_count >= 2 || article.positive_reactions_count >= 10) {
            posts.push({
              text: `${article.title}\n${article.description}`,
              url: article.url,
              author: article.user.username,
              score: article.positive_reactions_count || 0,
              timestamp: new Date(article.published_at).getTime() / 1000,
            });
          }
        }
      } catch (err) {
        console.error(`[devto] tag ${tag} error:`, err.message);
        continue;
      }
    }

    console.log(`[devto] found ${posts.length} relevant articles`);
    return posts;
  } catch (err) {
    console.error("[devto] scrape error:", err.message);
    return [];
  }
}

module.exports = { scrapeDevTo };
