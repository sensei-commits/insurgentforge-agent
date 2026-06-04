// SOURCE: HackerNews scraper — hunt for automation and bot discussions
const https = require("https");

function fetchHN(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
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

async function scrapeHackerNews() {
  try {
    const items = [];

    // Get recent stories
    console.log("[hn] fetching top stories...");
    const topStories = await fetchHN("https://hacker-news.firebaseio.com/v0/topstories.json");

    if (!topStories) return [];

    // Sample top stories for Discord/bot/automation mentions
    if (!Array.isArray(topStories)) {
      console.log("[hn] topStories is not an array:", typeof topStories);
      return [];
    }

    for (const storyId of topStories.slice(0, 50)) {
      try {
        const story = await fetchHN(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`);

        if (!story || !story.title) continue;

        // Look for customer pain: cost issues, need for solutions, problems with existing tools
        const isRelevant =
          (/expensive|costly|paying|subscription|too.much|cost|price/i.test(story.title) ||
           /need|looking for|help|problem|issue|failing|broken|down/i.test(story.title) ||
           /discord.*bot|custom.*bot|bot.*service|automation.*service/i.test(story.title)) &&
          /discord|bot|automation|tool|service|platform/i.test(story.title) &&
          story.descendants >= 3; // Has discussion

        if (isRelevant) {
          items.push({
            text: `${story.title}\n${story.url || ""}`,
            url: `https://news.ycombinator.com/item?id=${storyId}`,
            author: story.by || "unknown",
            score: story.score || 0,
            timestamp: story.time || 0,
          });
        }
      } catch (err) {
        continue;
      }
    }

    console.log(`[hn] found ${items.length} relevant stories`);
    return items;
  } catch (err) {
    console.error("[hn] scrape error:", err.message);
    return [];
  }
}

module.exports = { scrapeHackerNews };
