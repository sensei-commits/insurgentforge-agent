// TOOL: Visibility Dashboard
// Direct links to unanswered questions you can answer (no scraping needed)
// You click → answer publicly → build authority

const visibilitySearches = [
  {
    site: "Stack Overflow",
    title: "Unanswered Discord Bot Questions",
    url: "https://stackoverflow.com/search?q=discord+bot&tab=newest&ml=0&answers=0",
    description: "Newest unanswered Discord bot questions - answer first = max visibility",
  },
  {
    site: "Stack Overflow",
    title: "Low-Score Discord.py Questions",
    url: "https://stackoverflow.com/search?q=discord.py&tab=newest&ml=0&score=0,1",
    description: "Low-engagement discord.py questions - help seekers",
  },
  {
    site: "Stack Overflow",
    title: "Low-Score Discord.js Questions",
    url: "https://stackoverflow.com/search?q=discord.js&tab=newest&ml=0&score=0,1",
    description: "Low-engagement discord.js questions - quality answers win here",
  },
  {
    site: "Quora",
    title: "How Much Does Discord Bot Cost?",
    url: "https://www.quora.com/search?q=how+much+does+it+cost+to+hire+a+discord+bot+developer",
    description: "People asking about pricing/hiring - direct customer intent",
  },
  {
    site: "Quora",
    title: "Best Discord Bot Service",
    url: "https://www.quora.com/search?q=best+discord+bot+service",
    description: "People looking for bot solutions - mention your approach",
  },
  {
    site: "Quora",
    title: "Discord Automation Questions",
    url: "https://www.quora.com/search?q=discord+automation",
    description: "Broader automation discussions - position your expertise",
  },
  {
    site: "Reddit",
    title: "r/Discord_Bots - New Posts",
    url: "https://www.reddit.com/r/Discord_Bots/new/",
    description: "Real people asking for bot help - answer = DMs from prospects",
  },
  {
    site: "Reddit",
    title: "r/learnprogramming - Discord Tags",
    url: "https://www.reddit.com/r/learnprogramming/search/?q=discord&sort=new",
    description: "People learning - build relationship, future customers",
  },
];

function buildVisibilityDashboard() {
  return visibilitySearches;
}

async function sendVisibilityDashboardToDiscord(client, channelId, ownerId) {
  try {
    const { EmbedBuilder } = require("discord.js");
    const channel = await client.channels.fetch(channelId);

    const dashboard = buildVisibilityDashboard();

    // Create embed with visibility opportunities
    const embed = new EmbedBuilder()
      .setTitle("👁️ VISIBILITY DASHBOARD - Quick Links to Answer Questions")
      .setColor(0x00dd00)
      .setDescription(
        "Click these links → Find unanswered questions → Answer publicly → Build your authority\n\n" +
        "**Strategy:** Answer first + add your expertise → They find you when searching → DMs start coming in"
      );

    // Add each search as a field
    for (const search of dashboard) {
      embed.addFields({
        name: `${search.site}: ${search.title}`,
        value: `${search.description}\n[Go to search](${search.url})`,
        inline: false,
      });
    }

    embed
      .setFooter({
        text: "Check daily - answer 1-2 questions per day to build momentum",
      })
      .setTimestamp();

    await channel.send({
      content: `<@${ownerId}> 👁️ **YOUR VISIBILITY DASHBOARD**`,
      embeds: [embed],
      allowedMentions: { users: [ownerId] },
    });

    console.log("[visibility] dashboard sent to Discord");
  } catch (err) {
    console.error("[visibility] dashboard error:", err.message);
  }
}

module.exports = {
  buildVisibilityDashboard,
  sendVisibilityDashboardToDiscord,
};
