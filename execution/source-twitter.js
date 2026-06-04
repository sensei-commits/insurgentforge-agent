// SOURCE: Twitter scraper — find people complaining about bots, costs, pain points
// Web scraping approach targeting customer pain signals

async function scrapeTwitter() {
  try {
    const tweets = [];

    // Twitter search queries targeting CUSTOMER PAIN POINTS
    const searchQueries = [
      "discord bot too expensive",
      "looking for discord bot developer",
      "need help with discord bot",
      "discord bot alternative",
      "MEE6 too expensive",
      "paid bot service",
      "custom discord bot hire",
    ];

    for (const query of searchQueries) {
      try {
        console.log(`[twitter] searching: "${query}"...`);

        // Use Twitter search endpoint (public search, no auth required)
        const searchUrl = `https://twitter.com/search?q=${encodeURIComponent(
          query
        )}&f=live`;

        const response = await fetch(searchUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });

        if (!response.ok) {
          console.log(`[twitter] returned ${response.status}`);
          continue;
        }

        const html = await response.text();

        // Extract tweets from HTML
        // Look for tweet text and links
        const tweetRegex = /data-testid="tweet"[^>]*>[\s\S]*?<a[^>]*href="\/[^/]+\/status\/([0-9]+)"[^>]*>[^<]*<\/a>[\s\S]*?<div[^>]*dir="auto"[^>]*>([^<]+)<\/div>/gi;

        let match;
        let count = 0;
        while ((match = tweetRegex.exec(html)) !== null && count < 10) {
          const tweetId = match[1];
          const tweetText = match[2];

          if (tweetText.length > 20) {
            tweets.push({
              text: tweetText,
              url: `https://twitter.com/i/web/status/${tweetId}`,
              author: "twitter_user",
              score: 10, // Default engagement score
              timestamp: Math.floor(Date.now() / 1000),
            });
            count++;
          }
        }

        // Rate limit to avoid blocking
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (err) {
        console.error(`[twitter] search error:`, err.message);
        continue;
      }
    }

    console.log(`[twitter] found ${tweets.length} relevant tweets`);
    return tweets;
  } catch (err) {
    console.error("[twitter] scrape error:", err.message);
    return [];
  }
}

module.exports = { scrapeTwitter };
