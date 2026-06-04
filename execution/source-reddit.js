// SOURCE: Reddit scraper — hunt for Discord bot prospects in relevant subreddits
const https = require("https");

const SUBREDDITS = [
  "Discord_Bots",        // Direct bot building community
  "discordapp",          // General Discord
  "learnprogramming",    // People building things
  "webdev",              // Automation-minded devs
];

async function fetchFromReddit(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "reddit.com",
      path: path,
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 InsurgentForge/1.0",
        "Accept": "application/json",
      },
      timeout: 10000,
    };

    https
      .request(options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (res.statusCode !== 200) {
            return reject(
              new Error(`Reddit returned ${res.statusCode}`)
            );
          }

          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            reject(new Error("Invalid JSON from Reddit"));
          }
        });
      })
      .on("error", reject)
      .on("timeout", () => reject(new Error("Reddit request timeout")))
      .end();
  });
}

async function scrapeReddit() {
  try {
    const posts = [];

    for (const subreddit of SUBREDDITS) {
      try {
        console.log(`[reddit] scraping r/${subreddit}...`);

        // Fetch hot posts from the past day
        const path = `/r/${subreddit}/hot.json?limit=50&t=day`;
        const response = await fetchFromReddit(path);

        if (!response.data || !response.data.children) {
          console.log(`[reddit] no data in response for r/${subreddit}`);
          continue;
        }

        for (const item of response.data.children) {
          const post = item.data;

          // Skip stickied posts and ads
          if (post.stickied || post.is_self === false) continue;

          // Look for posts about bots, automation, help requests
          const text = `${post.title}\n${post.selftext}`;
          const isRelevant =
            /bot|automation|help|need|looking|build|custom|discord bot|moderation|level/i.test(
              text
            ) &&
            !/buy|sell|trade|giveaway|scam|spam/i.test(text); // filter noise

          if (isRelevant && post.selftext.length > 20) {
            // Must have actual content
            posts.push({
              text: `${post.title}\n${post.selftext}`,
              url: `https://reddit.com${post.permalink}`,
              author: post.author,
              score: post.score,
              timestamp: post.created_utc,
            });
          }
        }

        // Rate limit: small delay between subreddit requests
        await new Promise((resolve) => setTimeout(resolve, 1000));
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
