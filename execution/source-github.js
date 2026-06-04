// SOURCE: GitHub scraper — hunt for feature requests and bot ideas
const https = require("https");

async function fetchGitHub(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path,
      headers: {
        "User-Agent": "InsurgentForge/1.0",
        "Accept": "application/vnd.github.v3+json",
      },
    };

    https
      .get(options, (res) => {
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

async function scrapeGitHub() {
  try {
    const issues = [];

    // Search for RECENT feature requests (past 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateFilter = sevenDaysAgo.toISOString().split('T')[0];

    const queries = [
      `repo:discordjs/discord.js is:issue is:open label:"enhancement" "bot" updated:>${dateFilter}`,
      `repo:Rapptz/discord.py is:issue is:open label:"enhancement" updated:>${dateFilter}`,
      `is:issue is:open "discord bot" "feature request" updated:>${dateFilter}`,
    ];

    for (const query of queries) {
      try {
        console.log(`[github] searching: ${query.slice(0, 50)}...`);

        const path = `/search/issues?q=${encodeURIComponent(query)}&sort=updated&per_page=30`;
        const response = await fetchGitHub(path);

        if (!response.items) continue;

        for (const issue of response.items.slice(0, 20)) {
          // Only high-engagement issues (likely real problems)
          if (issue.comments >= 2) {
            issues.push({
              text: `${issue.title}\n${issue.body}`,
              url: issue.html_url,
              author: issue.user.login,
              score: issue.reactions["+1"] || 0,
              timestamp: new Date(issue.created_at).getTime() / 1000,
            });
          }
        }
      } catch (err) {
        console.error(`[github] query error:`, err.message);
        continue;
      }
    }

    console.log(`[github] found ${issues.length} relevant issues`);
    return issues;
  } catch (err) {
    console.error("[github] scrape error:", err.message);
    return [];
  }
}

module.exports = { scrapeGitHub };
