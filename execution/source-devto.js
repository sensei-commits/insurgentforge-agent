// SOURCE: Dev.to scraper — hunt for Discord/bot building discussions
const https = require("https");

function fetchDevTo(path) {
  return new Promise((resolve, reject) => {
    https
      .get(`https://dev.to/api${path}`, { headers: { "User-Agent": "InsurgentForge/1.0" } }, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

async function scrapeDevTo() {
  try {
    const posts = [];

    // Search for relevant articles
    const tags = ["discord", "bot", "automation", "api"];

    for (const tag of tags) {
      try {
        console.log(`[devto] searching tag: ${tag}...`);

        const response = await fetchDevTo(`/articles?tag=${tag}&per_page=30&sort=-published_at`);

        if (!Array.isArray(response)) continue;

        for (const article of response.slice(0, 20)) {
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
