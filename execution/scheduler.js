// SCHEDULER (implements SOP-06).
// Runs the persistent bot + sets up cron jobs for automated research.
// This is the entry point for Railway deployment.
require("dotenv").config();
const cron = require("node-cron");
const {
  Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
} = require("discord.js");
const { query, pool } = require("./db");
const { publishDraft, rejectDraft } = require("./publish");

// Import the research pipeline
const { runDeepResearch } = require("./research");
// Import email monitoring and scheduled publishing
const { monitorEmails, deliverInteractions } = require("./email-monitor");
const { publishScheduledPosts } = require("./scheduled-publisher");

const OWNER_ID = process.env.DISCORD_OWNER_ID;
const CHANNEL_ID = process.env.DISCORD_TRENDS_CHANNEL_ID;
const ORCA = "🐋";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const tasks = [];

// ── HELPERS ──────────────────────────────────────────────────────────────

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
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`vg_approve:${id}`).setLabel("Approve & Publish").setEmoji("✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`vg_reject:${id}`).setLabel("Reject").setEmoji("❌").setStyle(ButtonStyle.Danger),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`vg_schedule:${id}`).setLabel("Schedule 10am Tomorrow").setEmoji("📅").setStyle(ButtonStyle.Primary),
  );
  return [row1, row2];
}

async function deliverPendingDrafts() {
  const channel = await client.channels.fetch(CHANNEL_ID);
  const { rows } = await query(
    `SELECT * FROM vg_drafts WHERE status='pending_approval' AND delivered_at IS NULL ORDER BY created_at ASC`
  );
  if (!rows.length) return;
  for (const d of rows) {
    await channel.send({
      content: `<@${OWNER_ID}> new draft ready for your call:`,
      embeds: [draftEmbed(d)],
      components: buttons(d.id),
      allowedMentions: { users: [OWNER_ID] },
    });
    await query(`UPDATE vg_drafts SET delivered_at=now() WHERE id=$1`, [d.id]);
  }
}

// ── BOT READY ────────────────────────────────────────────────────────────

let started = false;
async function onReady() {
  if (started) return;
  started = true;
  console.log(`\n${new Date().toISOString()} [scheduler] ${ORCA} Vanguard online as ${client.user.tag}`);
  console.log(`[scheduler] Listening for approvals on <#${CHANNEL_ID}>`);
  console.log(`[scheduler] Research cron jobs ready.`);
  try { await deliverPendingDrafts(); } catch (e) { console.error("[scheduler] deliver error:", e.message); }
}
client.once("ready", onReady);
client.once("clientReady", onReady);

// ── BUTTON INTERACTIONS ──────────────────────────────────────────────────

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  const [action, draftId] = interaction.customId.split(":");
  if (!["vg_approve", "vg_reject", "vg_schedule"].includes(action)) return;

  if (interaction.user.id !== OWNER_ID) {
    return interaction.reply({ content: "Only the owner can manage drafts.", ephemeral: true });
  }

  await interaction.deferUpdate();
  const disabledRow1 = new ActionRowBuilder().addComponents(
    ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
    ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true),
  );
  const disabledRow2 = new ActionRowBuilder().addComponents(
    ButtonBuilder.from(interaction.message.components[1].components[0]).setDisabled(true),
  );

  try {
    if (action === "vg_approve") {
      const { url } = await publishDraft(draftId);
      await interaction.message.edit({
        content: `✅ Published by <@${OWNER_ID}> → ${url}`,
        components: [disabledRow1, disabledRow2],
        allowedMentions: { users: [] },
      });
      console.log(`[scheduler] published draft ${draftId} → ${url}`);
    } else if (action === "vg_schedule") {
      const tomorrow10am = new Date();
      tomorrow10am.setDate(tomorrow10am.getDate() + 1);
      tomorrow10am.setHours(10, 0, 0, 0);
      const estOffset = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
      const estTime = new Date(estOffset);
      const diffMs = estTime.getTime() - new Date().getTime();
      tomorrow10am.setTime(tomorrow10am.getTime() - diffMs);
      await query(`UPDATE vg_drafts SET scheduled_publish_at=$1 WHERE id=$2`, [tomorrow10am, draftId]);
      await interaction.message.edit({
        content: `📅 Scheduled by <@${OWNER_ID}> to publish tomorrow at 10:00 AM EST`,
        components: [disabledRow1, disabledRow2],
        allowedMentions: { users: [] },
      });
      console.log(`[scheduler] scheduled draft ${draftId} for ${tomorrow10am.toISOString()}`);
    } else {
      await rejectDraft(draftId);
      await interaction.message.edit({
        content: `❌ Rejected by <@${OWNER_ID}>. Nothing was posted.`,
        components: [disabledRow1, disabledRow2],
        allowedMentions: { users: [] },
      });
      console.log(`[scheduler] rejected draft ${draftId}`);
    }
  } catch (err) {
    await interaction.followUp({ content: `⚠️ Action failed: ${err.message}`, ephemeral: true });
    console.error(`[scheduler] action error on ${draftId}:`, err.message);
  }
});

// ── CRON JOBS ────────────────────────────────────────────────────────────

async function runCronDeepResearch() {
  const ts = new Date().toISOString();
  console.log(`\n${ts} [scheduler] 🔍 DEEP research run started (weekly)`);
  try {
    await runDeepResearch({ trigger: "cron_weekly" });
    console.log(`${new Date().toISOString()} [scheduler] ✅ deep run complete.`);
  } catch (e) {
    console.error(`${new Date().toISOString()} [scheduler] ❌ deep run failed: ${e.message}`);
  }
}

async function runCronLightResearch() {
  const ts = new Date().toISOString();
  console.log(`${ts} [scheduler] ⚡ LIGHT research run started (daily)`);
  try {
    // For light runs, we do a quick check but use the same pipeline
    // (In future, could implement a faster subset of sources)
    await runDeepResearch({ trigger: "cron_daily" });
    console.log(`${new Date().toISOString()} [scheduler] ✅ light run complete.`);
  } catch (e) {
    console.error(`${new Date().toISOString()} [scheduler] ❌ light run failed: ${e.message}`);
  }
}

async function runCronEmailMonitor() {
  const ts = new Date().toISOString();
  console.log(`${ts} [scheduler] 📧 Checking for social media emails...`);
  try {
    const interactions = await monitorEmails();
    if (interactions.length > 0) {
      await deliverInteractions(interactions);
      console.log(`${new Date().toISOString()} [scheduler] ✅ delivered ${interactions.length} email summaries.`);
    }
  } catch (e) {
    console.error(`${new Date().toISOString()} [scheduler] ❌ email monitor failed: ${e.message}`);
  }
}

async function runCronScheduledPublisher() {
  try {
    const result = await publishScheduledPosts();
    if (result.published > 0) {
      console.log(`${new Date().toISOString()} [scheduler] ✅ published ${result.published} scheduled posts.`);
    }
  } catch (e) {
    console.error(`${new Date().toISOString()} [scheduler] ❌ scheduled publisher failed: ${e.message}`);
  }
}

function setupCrons() {
  // Deep run: Monday 9:00 AM local time
  const deepTask = cron.schedule("0 9 * * 1", runCronDeepResearch, { name: "vanguard_deep" });
  tasks.push(deepTask);
  console.log("[scheduler] DEEP cron: Mondays at 9:00 AM (local)");

  // Light run: daily 9:00 AM local time
  const lightTask = cron.schedule("0 9 * * *", runCronLightResearch, { name: "vanguard_light" });
  tasks.push(lightTask);
  console.log("[scheduler] LIGHT cron: daily at 9:00 AM (local)");

  // Email monitor: every 30 minutes
  const emailTask = cron.schedule("*/30 * * * *", runCronEmailMonitor, { name: "vanguard_email" });
  tasks.push(emailTask);
  console.log("[scheduler] EMAIL monitor: every 30 minutes");

  // Scheduled publisher: every 5 minutes
  const publishTask = cron.schedule("*/5 * * * *", runCronScheduledPublisher, { name: "vanguard_publish" });
  tasks.push(publishTask);
  console.log("[scheduler] SCHEDULED publisher: every 5 minutes");
}

// ── LIFECYCLE ────────────────────────────────────────────────────────────

function startup() {
  console.log(`${new Date().toISOString()} [scheduler] 🚀 Vanguard starting up...`);
  setupCrons();
  client.login(process.env.DISCORD_TOKEN);
}

async function shutdown(signal) {
  console.log(`\n${new Date().toISOString()} [scheduler] ⏹️ Received ${signal}, shutting down gracefully...`);
  tasks.forEach(t => t.stop());
  console.log("[scheduler] cron jobs cancelled.");
  await client.destroy().catch(() => {});
  await pool.end().catch(() => {});
  console.log("[scheduler] ✅ clean shutdown.");
  process.exitCode = 0;
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startup();
