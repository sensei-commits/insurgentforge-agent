// SOURCE: Reddit scraper — hunt for Discord bot prospects in relevant subreddits
const https = require("https");

const SUBREDDITS = [
  "Discord_Bots",        // Direct bot building community
  "discordapp",          // General Discord
  "learnprogramming",    // People building things
  "webdev",              // Automation-minded devs
  "Python",              // Python Discord bot builders
];

async function scrapeReddit() {
  try {
    const posts = [];

    for (const subreddit of SUBREDDITS) {
      try {
        console.log(`[reddit] scraping r/${subreddit}...`);

        // Fetch latest posts (past 24 hours) with proper User-Agent
        const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=50&t=day`;
        const response = await new Promise((resolve, reject) => {
          https.get(url, { headers: { "User-Agent": "InsurgentForge/1.0 (by iNFAMOUSII8)" } }, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                reject(e);
              }
            });
          }).on("error", reject);
        });

        if (!response.data || !response.data.children) continue;

        for (const item of response.data.children) {
          const post = item.data;

          // Look for posts about bots, automation, help requests
          const text = `${post.title}\n${post.selftext}`;
          const isRelevant =
            /bot|discord|automation|help|need|looking|build|custom/i.test(text) &&
            !/buy|sell|trade|giveaway|meme/i.test(text); // filter noise

          if (isRelevant) {
            posts.push({
              text: `${post.title}\n${post.selftext}`,
              url: `https://reddit.com${post.permalink}`,
              author: post.author,
              score: post.score,
              timestamp: post.created_utc,
            });
          }
        }
      } catch (err) {
        console.error(`[reddit] r/${subreddit} error:`, err.message);
        continue;
      }
    }

    console.log(`[reddit] found ${posts.length} relevant posts`);
    return posts;
  } catch (err) {
    console.error("[reddit] scrape error:", err.message);
    return [];
  }
}

module.exports = { scrapeReddit };
