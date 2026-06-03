// PERSISTENT BOT (Navigation layer, implements SOP-05).
// Connects to the Discord gateway, delivers pending drafts with ✅/❌ buttons,
// and publishes on the owner's approval. This is the process deployed in Step 8.
require("dotenv").config();
const {
  Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
} = require("discord.js");
const { query, pool } = require("./db");
const { publishDraft, rejectDraft } = require("./publish");

const OWNER_ID = process.env.DISCORD_OWNER_ID;
const CHANNEL_ID = process.env.DISCORD_TRENDS_CHANNEL_ID;
const ORCA = "🐋";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function draftEmbed(d) {
  const vc = d.voice_check || {};
  const preview = (d.body || "").slice(0, 1500);
  return new EmbedBuilder()
    .setTitle(`${ORCA} Draft for approval — ${d.platform}`)
    .setDescription((d.title ? `**${d.title}**\n\n` : "") + preview)
    .setColor(0x1f6feb)
    .addFields({
      name: "Voice check",
      value: `human: ${vc.sounds_human ? "✅" : "⚠️"} · cliches: ${(vc.ai_cliches_found || []).length} · dup: ${vc.duplicate_of ? "⚠️ possible" : "none"}`,
    })
    .setFooter({ text: `InsurgentForge • Vanguard • draft ${String(d.id).slice(0, 8)}` })
    .setTimestamp(new Date());
}

function buttons(id) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`vg_approve:${id}`).setLabel("Approve & Publish").setEmoji("✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`vg_schedule:${id}`).setLabel("Schedule 10am Tomorrow").setEmoji("📅").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`vg_reject:${id}`).setLabel("Reject").setEmoji("❌").setStyle(ButtonStyle.Danger),
  );
}

async function deliverPendingDrafts() {
  const channel = await client.channels.fetch(CHANNEL_ID);
  const { rows } = await query(
    `SELECT * FROM vg_drafts WHERE status='pending_approval' AND delivered_at IS NULL ORDER BY created_at ASC`
  );
  if (!rows.length) { console.log("[bot] no pending drafts to deliver."); return; }
  for (const d of rows) {
    await channel.send({
      content: `<@${OWNER_ID}> new draft ready for your call:`,
      embeds: [draftEmbed(d)],
      components: [buttons(d.id)],
      allowedMentions: { users: [OWNER_ID] },
    });
    await query(`UPDATE vg_drafts SET delivered_at=now() WHERE id=$1`, [d.id]);
    console.log(`[bot] delivered draft ${d.id} (${d.platform}).`);
  }
}

let started = false;
async function onReady() {
  if (started) return; // both 'ready' and 'clientReady' may fire across versions — run once
  started = true;
  console.log(`[bot] online as ${client.user.tag}. Listening for approvals.`);
  try { await deliverPendingDrafts(); } catch (e) { console.error("[bot] deliver error:", e.message); }
}
client.once("ready", onReady);
client.once("clientReady", onReady);

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  const [action, draftId] = interaction.customId.split(":");
  if (!["vg_approve", "vg_reject", "vg_schedule"].includes(action)) return;

  // only the owner may act on drafts
  if (interaction.user.id !== OWNER_ID) {
    return interaction.reply({ content: "Only the owner can manage drafts.", ephemeral: true });
  }

  await interaction.deferUpdate();
  const disabledRow = new ActionRowBuilder().addComponents(
    ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
    ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true),
    ButtonBuilder.from(interaction.message.components[0].components[2]).setDisabled(true),
  );

  try {
    if (action === "vg_approve") {
      const { url } = await publishDraft(draftId);
      await interaction.message.edit({
        content: `✅ Published by <@${OWNER_ID}> → ${url}`,
        components: [disabledRow],
        allowedMentions: { users: [] },
      });
      console.log(`[bot] published draft ${draftId} → ${url}`);
    } else if (action === "vg_schedule") {
      // Schedule for 10am EST tomorrow
      const tomorrow10am = new Date();
      tomorrow10am.setDate(tomorrow10am.getDate() + 1);
      tomorrow10am.setHours(10, 0, 0, 0);
      // Adjust for EST (UTC-5, or EDT UTC-4)
      const estOffset = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
      const estTime = new Date(estOffset);
      const diffMs = estTime.getTime() - new Date().getTime();
      tomorrow10am.setTime(tomorrow10am.getTime() - diffMs);

      await query(
        `UPDATE vg_drafts SET scheduled_publish_at=$1 WHERE id=$2`,
        [tomorrow10am, draftId]
      );
      await interaction.message.edit({
        content: `📅 Scheduled by <@${OWNER_ID}> to publish tomorrow at 10:00 AM EST`,
        components: [disabledRow],
        allowedMentions: { users: [] },
      });
      console.log(`[bot] scheduled draft ${draftId} for ${tomorrow10am.toISOString()}`);
    } else {
      await rejectDraft(draftId);
      await interaction.message.edit({
        content: `❌ Rejected by <@${OWNER_ID}>. Nothing was posted.`,
        components: [disabledRow],
        allowedMentions: { users: [] },
      });
      console.log(`[bot] rejected draft ${draftId}`);
    }
  } catch (err) {
    await interaction.followUp({ content: `⚠️ Action failed: ${err.message}`, ephemeral: true });
    console.error(`[bot] action error on ${draftId}:`, err.message);
  }
});

client.login(process.env.DISCORD_TOKEN);

// graceful shutdown
process.on("SIGINT", async () => { await client.destroy(); await pool.end().catch(() => {}); process.exit(0); });
process.on("SIGTERM", async () => { await client.destroy(); await pool.end().catch(() => {}); process.exit(0); });
