// SOURCE: Twitter scraper — find people complaining about bots, costs, and automation needs
// Targets: tweets about Discord bot costs, complaints, "looking for" messages

async function scrapeTwitter() {
  try {
    const tweets = [];

    // Twitter search queries targeting pain points and customer needs
    const searchQueries = [
      "discord bot too expensive", // Cost pain
      "discord bot pricing complaint", // Cost complaints
      "looking for discord bot developer", // Direct need
      "need help discord bot", // Help request
      "discord bot broken alternatives", // Current solution issues
      "MEE6 alternative cheaper", // Specific competitor pain
      "Dyno too costly", // Specific competitor pain
      "custom discord bot hire", // Direct service request
    ];

    for (const query of searchQueries) {
      try {
        console.log(`[twitter] searching: "${query}"...`);

        // Twitter's advanced search URL format (public, no API key needed)
        // Using Twitter's public search which returns JSON
        const searchUrl = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(
          query
        )}&max_results=100&tweet.fields=public_metrics,created_at&user.fields=username,created_at`;

        // Check if we have Twitter API key for authenticated requests
        const headers = {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        };

        if (process.env.TWITTER_BEARER_TOKEN) {
          headers["Authorization"] = `Bearer ${process.env.TWITTER_BEARER_TOKEN}`;
        }

        const response = await fetch(searchUrl, { headers });

        if (response.status === 429) {
          console.log("[twitter] rate limited, skipping remaining queries");
          break;
        }

        if (!response.ok) {
          console.log(`[twitter] query "${query}" returned ${response.status}`);
          continue;
        }

        const data = await response.json();

        if (!data.data || !Array.isArray(data.data)) {
          continue;
        }

        // Extract relevant tweets
        for (const tweet of data.data) {
          // Filter for engagement (retweets, likes, replies = real signals)
          const engagement =
            (tweet.public_metrics?.retweet_count || 0) +
            (tweet.public_metrics?.like_count || 0) +
            (tweet.public_metrics?.reply_count || 0);

          if (engagement >= 1) {
            // At least 1 interaction = real signal
            tweets.push({
              text: tweet.text,
              url: `https://twitter.com/i/web/status/${tweet.id}`,
              author: tweet.author_id || "twitter_user",
              score: engagement,
              timestamp: new Date(tweet.created_at).getTime() / 1000,
            });
          }
        }

        // Rate limit: 1 second between requests
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(`[twitter] query "${query}" error:`, err.message);
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
