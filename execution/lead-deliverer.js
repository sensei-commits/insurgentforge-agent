// TOOL: Deliver leads to Discord with full context
const { EmbedBuilder } = require("discord.js");
const { query } = require("./db");

async function deliverLeadsToDiscord(client, channelId, ownerId, leads) {
  try {
    if (!leads.length) return;

    const channel = await client.channels.fetch(channelId);

    for (const lead of leads) {
      // Build the title with clickable link if available
      let titleText = `🎯 ${lead.problem.slice(0, 100)}`;
      if (titleText.length > 100) titleText += "...";

      const embed = new EmbedBuilder()
        .setTitle(titleText)
        .setColor(0x00ff00);

      // Add source link FIRST and prominently
      if (lead.source_url) {
        embed.setURL(lead.source_url); // Makes title clickable
        embed.addFields({
          name: "📍 VIEW POST",
          value: `[Open on ${lead.source.toUpperCase()}](${lead.source_url})`,
          inline: false,
        });
      }

      // Add source and author info
      embed.addFields({
        name: "Source",
        value: `${lead.source.toUpperCase()} ${lead.source_author ? `by @${lead.source_author}` : "(author unavailable)"}`,
        inline: true,
      });

      if (lead.urgency) {
        embed.addFields({ name: "Urgency", value: lead.urgency, inline: true });
      }

      // Add the actual problem/details
      embed.addFields({
        name: "Problem Statement",
        value: lead.problem.slice(0, 1024),
        inline: false,
      });

      if (lead.current_solution) {
        embed.addFields({
          name: "Current Solution",
          value: lead.current_solution,
          inline: false,
        });
      }

      if (lead.pain_points) {
        embed.addFields({
          name: "Pain Points",
          value: lead.pain_points,
          inline: false,
        });
      }

      // Add scale and budget
      const details = [];
      if (lead.scale) details.push(`📊 Scale: ${lead.scale}`);
      if (lead.budget) details.push(`💰 Budget: ${lead.budget}`);
      if (details.length > 0) {
        embed.addFields({
          name: "Details",
          value: details.join(" | "),
          inline: false,
        });
      }

      // Add contact info if available
      if (lead.email || lead.discord) {
        const contact = [];
        if (lead.email) contact.push(`📧 ${lead.email}`);
        if (lead.discord) contact.push(`🎮 ${lead.discord}`);
        embed.addFields({
          name: "Contact Info",
          value: contact.join(" | "),
          inline: false,
        });
      }

      embed.setFooter({ text: `Lead #${lead.id} | ${lead.source}` }).setTimestamp();

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
