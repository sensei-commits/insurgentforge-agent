// SOURCE: Reddit scraper — hunt for Discord bot prospects in relevant subreddits

const SUBREDDITS = [
  "Discord_Bots",        // Direct bot building community
  "discordapp",          // General Discord
  "learnprogramming",    // People building things
  "webdev",              // Automation-minded devs
];

async function fetchFromReddit(path) {
  // Use Node 18+ built-in fetch with automatic redirect following
  const url = `https://www.reddit.com${path}`; // Use www.reddit.com to avoid redirect loop

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
      timeout: 10000,
    });

    if (!response.ok) {
      throw new Error(`Reddit returned ${response.status}`);
    }

    // Reddit returns JSON when requested via JSON content type
    const text = await response.text();
    const data = JSON.parse(text);
    return data;
  } catch (err) {
    throw new Error(`Reddit fetch failed: ${err.message}`);
  }
}

async function scrapeReddit() {
  try {
    const posts = [];

    for (const subreddit of SUBREDDITS) {
      try {
        console.log(`[reddit] scraping r/${subreddit}...`);

        // Fetch hot posts from the past week (t=week for more volume)
        const path = `/r/${subreddit}/hot.json?limit=50&t=week`;
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
