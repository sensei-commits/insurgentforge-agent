// TOOL: Deliver leads to Discord with full context
const { EmbedBuilder } = require("discord.js");
const { query } = require("./db");

async function deliverLeadsToDiscord(client, channelId, ownerId, leads) {
  try {
    if (!leads.length) return;

    const channel = await client.channels.fetch(channelId);

    for (const lead of leads) {
      const embed = new EmbedBuilder()
        .setTitle(`🎯 REAL LEAD: ${lead.problem}`)
        .setColor(0x00ff00)
        .addFields(
          { name: "Source", value: `${lead.source.toUpperCase()} (@${lead.source_author || "unknown"})`, inline: true },
          { name: "Urgency", value: lead.urgency || "unknown", inline: true },
          {
            name: "Current Solution",
            value: lead.current_solution || "None mentioned",
            inline: false,
          },
          { name: "Pain Points", value: lead.pain_points || "N/A", inline: false },
          {
            name: "Scale",
            value: lead.scale || "unknown",
            inline: true,
          },
          {
            name: "Budget",
            value: lead.budget || "unknown",
            inline: true,
          }
        )
        .setFooter({ text: `Lead ID: ${lead.id}` })
        .setTimestamp();

      // Add contact info if available
      if (lead.email || lead.discord) {
        const contact = [];
        if (lead.email) contact.push(`📧 ${lead.email}`);
        if (lead.discord) contact.push(`🎮 ${lead.discord}`);
        embed.addFields({ name: "Contact", value: contact.join(" | "), inline: false });
      }

      // Add source link
      if (lead.source_url) {
        embed.addFields({ name: "Post Link", value: `[View on ${lead.source}](${lead.source_url})`, inline: false });
      }

      await channel.send({
        content: `<@${ownerId}> 🎯 **NEW QUALIFIED LEAD**`,
        embeds: [embed],
        allowedMentions: { users: [ownerId] },
      });

      // Mark as delivered
      await query(`UPDATE vg_mining_leads SET delivered_at=now() WHERE id=$1`, [lead.id]);

      console.log(`[lead-deliverer] delivered lead ${lead.id} to Discord`);
    }
  } catch (err) {
    console.error("[lead-deliverer] error:", err.message);
  }
}

async function deliverDailyDigest(client, channelId, ownerId) {
  try {
    // Get top 10 leads from past 24 hours
    const { rows: leads } = await query(
      `SELECT * FROM vg_mining_leads
       WHERE created_at > now() - interval '24 hours'
       ORDER BY
         CASE urgency WHEN 'immediate' THEN 1 WHEN 'soon' THEN 2 ELSE 3 END,
         created_at DESC
       LIMIT 10`
    );

    if (!leads.length) {
      console.log("[lead-deliverer] no leads for daily digest");
      return;
    }

    const channel = await client.channels.fetch(channelId);

    const embed = new EmbedBuilder()
      .setTitle(`📊 Daily Leads Digest (${leads.length} qualified)`)
      .setColor(0x0099ff)
      .setDescription(
        leads
          .map(
            (l, i) =>
              `**${i + 1}. ${l.problem}** (${l.urgency || "unknown"} urgency)\n` +
              `   Current: ${l.current_solution || "None"} | Scale: ${l.scale || "?"} | Budget: ${l.budget || "?"}\n` +
              `   Source: [${l.source.toUpperCase()}](${l.source_url})`
          )
          .join("\n\n")
      )
      .setFooter({ text: `Total leads in DB: ${leads.length}` })
      .setTimestamp();

    await channel.send({
      content: `<@${ownerId}> 📊 **TODAY'S QUALIFIED LEADS**`,
      embeds: [embed],
      allowedMentions: { users: [ownerId] },
    });

    console.log(`[lead-deliverer] sent daily digest with ${leads.length} leads`);
  } catch (err) {
    console.error("[lead-deliverer] digest error:", err.message);
  }
}

module.exports = { deliverLeadsToDiscord, deliverDailyDigest };
