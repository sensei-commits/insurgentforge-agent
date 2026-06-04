// TOOL: Analytics engine — tracks post performance and generates insights
const { query } = require("./db");

async function trackPostMetrics(draftId, platforms) {
  // When content is published, record the platforms
  try {
    const platforms_str = platforms.join(", ");
    await query(
      `UPDATE vg_content_drafts SET published_platforms=$1 WHERE id=$2`,
      [platforms_str, draftId]
    );
  } catch (err) {
    console.error(`[analytics] metric tracking error:`, err.message);
  }
}

async function generateAnalyticsReport() {
  try {
    console.log(`[analytics] generating report...`);

    // Get published posts
    const { rows: posts } = await query(
      `SELECT * FROM vg_content_drafts
       WHERE status='approved' AND published_at IS NOT NULL
       ORDER BY published_at DESC LIMIT 50`,
      []
    );

    if (!posts.length) {
      console.log(`[analytics] no published posts yet`);
      return null;
    }

    // Analyze by topic
    const byTopic = {};
    const byTime = {};
    const byPlatform = { bluesky: 0, mastodon: 0, devto: 0 };

    for (const post of posts) {
      const topic = post.topic || "unknown";
      byTopic[topic] = (byTopic[topic] || 0) + 1;

      const hour = new Date(post.published_at).getHours();
      byTime[hour] = (byTime[hour] || 0) + 1;

      // Count platforms
      if (post.published_platforms) {
        if (post.published_platforms.includes("Bluesky")) byPlatform.bluesky++;
        if (post.published_platforms.includes("Mastodon")) byPlatform.mastodon++;
        if (post.published_platforms.includes("Dev.to")) byPlatform.devto++;
      }
    }

    // Find top topics
    const topTopics = Object.entries(byTopic)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic, count]) => `${topic} (${count})`);

    // Find best posting hour
    const bestHour = Object.entries(byTime).sort((a, b) => b[1] - a[1])[0];

    const report = {
      total_published: posts.length,
      top_topics: topTopics,
      best_posting_hour: bestHour ? `${bestHour[0]}:00` : "unknown",
      platforms: byPlatform,
      generated_at: new Date().toISOString(),
    };

    return report;
  } catch (err) {
    console.error(`[analytics] report error:`, err.message);
    return null;
  }
}

async function getLeadInsights() {
  try {
    // Get high-value leads
    const { rows: leads } = await query(
      `SELECT * FROM gmail_messages
       WHERE lead_score >= 70
       ORDER BY lead_score DESC LIMIT 10`,
      []
    );

    if (!leads.length) {
      return { high_value_leads: 0, total_scored: 0 };
    }

    const { rows: stats } = await query(
      `SELECT COUNT(*) as total FROM gmail_messages WHERE lead_score IS NOT NULL`,
      []
    );

    return {
      high_value_leads: leads.length,
      total_scored: stats[0].total,
      top_lead_problem: leads[0]?.lead_problem || "unknown",
      avg_score:
        Math.round((leads.reduce((sum, l) => sum + l.lead_score, 0) / leads.length) * 10) / 10,
    };
  } catch (err) {
    console.error(`[analytics] lead insights error:`, err.message);
    return null;
  }
}

async function getDailyStats() {
  try {
    const { rows: contentStats } = await query(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) as rejected
       FROM vg_content_drafts
       WHERE created_at > now() - interval '7 days'`,
      []
    );

    return {
      week_total: contentStats[0].total,
      week_approved: contentStats[0].approved || 0,
      week_rejected: contentStats[0].rejected || 0,
      approval_rate:
        contentStats[0].total > 0
          ? Math.round(((contentStats[0].approved || 0) / contentStats[0].total) * 100)
          : 0,
    };
  } catch (err) {
    console.error(`[analytics] daily stats error:`, err.message);
    return null;
  }
}

module.exports = { trackPostMetrics, generateAnalyticsReport, getLeadInsights, getDailyStats };
