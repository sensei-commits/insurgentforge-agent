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
// Import content generator, auto-publisher, and intelligence tools
const { generateDailyContent } = require("./content-generator");
const { publishDraftToAll } = require("./auto-publisher");
const { analyzeIncomingEmails } = require("./lead-scorer");
const { trackCompetitors } = require("./competitor-tracker");
const { generateAnalyticsReport, getLeadInsights, getDailyStats } = require("./analytics-engine");
// Phase 2: repurposing, sequences, crm
const { repurposeApprovedContent } = require("./content-repurposer");
const { launchSequencesForHighValueLeads } = require("./email-sequences");
const { getCRMDashboard } = require("./crm-sync");

const OWNER_ID = process.env.DISCORD_OWNER_ID;
const CHANNEL_ID = process.env.DISCORD_TRENDS_CHANNEL_ID;
const ORCA = "🐋";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});
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

function contentDraftEmbed(d) {
  const preview = `**${d.title}**\n\n📱 Platforms: Reddit, Bluesky, Mastodon, Dev.to\n📋 Twitter & LinkedIn drafts included\n\nTopic: ${d.topic}`;
  return new EmbedBuilder()
    .setTitle("✨ Daily Content Ready for Approval")
    .setDescription(preview)
    .setColor(0x00d4ff)
    .addFields(
      { name: "Reddit", value: d.reddit.slice(0, 500) + (d.reddit.length > 500 ? "..." : ""), inline: false },
      { name: "Bluesky", value: d.bluesky.slice(0, 100) + (d.bluesky.length > 100 ? "..." : ""), inline: false }
    )
    .setFooter({ text: `InsurgentForge • Content ${String(d.id).slice(0, 8)}` })
    .setTimestamp(new Date());
}

function contentButtons(id) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`vc_approve:${id}`).setLabel("Approve & Queue").setEmoji("✅").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`vc_reject:${id}`).setLabel("Reject").setEmoji("❌").setStyle(ButtonStyle.Danger),
    ),
  ];
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

async function deliverContentDrafts() {
  const channel = await client.channels.fetch(CHANNEL_ID);
  const { rows } = await query(
    `SELECT * FROM vg_content_drafts WHERE status='pending_approval' AND delivered_at IS NULL ORDER BY created_at ASC`
  );
  if (!rows.length) return;
  for (const d of rows) {
    await channel.send({
      content: `<@${OWNER_ID}> daily content is ready:`,
      embeds: [contentDraftEmbed(d)],
      components: contentButtons(d.id),
      allowedMentions: { users: [OWNER_ID] },
    });
    await query(`UPDATE vg_content_drafts SET delivered_at=now() WHERE id=$1`, [d.id]);
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
  try {
    if (!interaction.isButton()) return;
    const [action, draftId] = interaction.customId.split(":");
    if (!["vg_approve", "vg_reject", "vg_schedule", "vc_approve", "vc_reject"].includes(action)) return;

    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({ content: "Only the owner can manage drafts.", ephemeral: true });
    }

    // Handle content draft buttons
    if (action.startsWith("vc_")) {
      await interaction.deferUpdate();
      const disabledRow = new ActionRowBuilder().addComponents(
        ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
        ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true),
      );

      if (action === "vc_approve") {
        // Get the draft
        const { rows } = await query(`SELECT * FROM vg_content_drafts WHERE id=$1`, [draftId]);
        if (!rows.length) {
          return interaction.followUp({ content: "Draft not found.", ephemeral: true });
        }
        const draft = rows[0];

        // Publish to all platforms
        try {
          const published = await publishDraftToAll(draft);
          await query(
            `UPDATE vg_content_drafts SET status='approved', approved_at=now(), published_at=now() WHERE id=$1`,
            [draftId]
          );
          const platforms = published.map((p) => `${p.platform}`).join(", ");
          await interaction.message.edit({
            content: `✅ Approved & published to: ${platforms}`,
            components: [disabledRow],
            allowedMentions: { users: [] },
          });
          console.log(`[scheduler] published content draft ${draftId} to ${platforms}`);
        } catch (err) {
          await interaction.message.edit({
            content: `⚠️ Approved but publishing failed: ${err.message}`,
            components: [disabledRow],
            allowedMentions: { users: [] },
          });
          console.error(`[scheduler] publishing error on ${draftId}:`, err.message);
        }
      } else if (action === "vc_reject") {
        await query(`UPDATE vg_content_drafts SET status='rejected', rejected_reason='Owner rejected' WHERE id=$1`, [draftId]);
        await interaction.message.edit({
          content: `❌ Rejected by <@${OWNER_ID}>`,
          components: [disabledRow],
          allowedMentions: { users: [] },
        });
        console.log(`[scheduler] rejected content draft ${draftId}`);
      }
      return;
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
  } catch (err) {
    console.error(`[scheduler] interaction error:`, err.message);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: `⚠️ Error: ${err.message}`, ephemeral: true });
      } else {
        await interaction.reply({ content: `⚠️ Error: ${err.message}`, ephemeral: true });
      }
    } catch (e) {
      console.error(`[scheduler] could not send error response:`, e.message);
    }
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

async function runCronDailyContent() {
  const ts = new Date().toISOString();
  console.log(`${ts} [scheduler] ✨ Generating daily content...`);
  try {
    const draft = await generateDailyContent();
    console.log(`${new Date().toISOString()} [scheduler] ✅ generated content draft: "${draft.title}"`);
  } catch (e) {
    console.error(`${new Date().toISOString()} [scheduler] ❌ content generation failed: ${e.message}`);
  }
}

async function runCronLeadScoring() {
  const ts = new Date().toISOString();
  console.log(`${ts} [scheduler] 🎯 Scoring incoming leads...`);
  try {
    const leads = await analyzeIncomingEmails();
    if (leads.length > 0) {
      const channel = await client.channels.fetch(CHANNEL_ID);
      const embed = new EmbedBuilder()
        .setTitle(`🎯 ${leads.length} High-Value Lead(s) Detected`)
        .setColor(0x00ff00)
        .setDescription(
          leads
            .map(
              (l) =>
                `**${l.from}** (Score: ${l.score})\n📌 ${l.problem}\n⏰ ${l.urgency}`
            )
            .join("\n\n")
        )
        .setFooter({ text: "InsurgentForge • Lead Intelligence" })
        .setTimestamp();
      await channel.send({
        content: `<@${OWNER_ID}> 🎯 check these leads!`,
        embeds: [embed],
        allowedMentions: { users: [OWNER_ID] },
      });
    }
    console.log(`${new Date().toISOString()} [scheduler] ✅ lead scoring complete: ${leads.length} high-value leads`);
  } catch (e) {
    console.error(`${new Date().toISOString()} [scheduler] ❌ lead scoring failed: ${e.message}`);
  }
}

async function runCronCompetitorTracking() {
  const ts = new Date().toISOString();
  console.log(`${ts} [scheduler] 🔍 Tracking competitors...`);
  try {
    const alerts = await trackCompetitors();
    if (alerts.length > 0) {
      const channel = await client.channels.fetch(CHANNEL_ID);
      for (const alert of alerts) {
        const embed = new EmbedBuilder()
          .setTitle(`🚨 ${alert.type.toUpperCase()}: ${alert.title}`)
          .setColor(alert.type === "threat" ? 0xff0000 : 0xffaa00)
          .addFields(
            { name: "Source", value: alert.source, inline: true },
            { name: "Confidence", value: `${alert.confidence}%`, inline: true },
            { name: "Insight", value: alert.insight },
            { name: "Action", value: alert.action }
          )
          .setFooter({ text: "InsurgentForge • Market Intelligence" })
          .setTimestamp();
        await channel.send({
          content: `<@${OWNER_ID}> market alert!`,
          embeds: [embed],
          allowedMentions: { users: [OWNER_ID] },
        });
      }
    }
    console.log(`${new Date().toISOString()} [scheduler] ✅ competitor tracking complete: ${alerts.length} alerts`);
  } catch (e) {
    console.error(`${new Date().toISOString()} [scheduler] ❌ competitor tracking failed: ${e.message}`);
  }
}

async function runCronWeeklyAnalytics() {
  const ts = new Date().toISOString();
  console.log(`${ts} [scheduler] 📊 Generating analytics report...`);
  try {
    const report = await generateAnalyticsReport();
    const leads = await getLeadInsights();
    const stats = await getDailyStats();

    if (report && leads) {
      const channel = await client.channels.fetch(CHANNEL_ID);
      const embed = new EmbedBuilder()
        .setTitle("📊 Weekly Performance Report")
        .setColor(0x0099ff)
        .addFields(
          { name: "Content Published", value: `${report.total_published}`, inline: true },
          { name: "Approval Rate", value: `${stats.approval_rate}%`, inline: true },
          { name: "Top Topics", value: report.top_topics.join(", ") || "N/A" },
          { name: "Best Posting Hour", value: report.best_posting_hour },
          { name: "High-Value Leads", value: `${leads.high_value_leads}`, inline: true },
          { name: "Avg Lead Score", value: `${leads.avg_score}`, inline: true },
          { name: "Platform Performance", value: `🦋 Bluesky: ${report.platforms.bluesky} | 🐘 Mastodon: ${report.platforms.mastodon} | 📝 Dev.to: ${report.platforms.devto}` }
        )
        .setFooter({ text: "InsurgentForge • Analytics" })
        .setTimestamp();
      await channel.send({
        content: `<@${OWNER_ID}> 📊 weekly performance snapshot:`,
        embeds: [embed],
        allowedMentions: { users: [OWNER_ID] },
      });
    }
    console.log(`${new Date().toISOString()} [scheduler] ✅ analytics report complete`);
  } catch (e) {
    console.error(`${new Date().toISOString()} [scheduler] ❌ analytics failed: ${e.message}`);
  }
}

async function runCronContentRepurposing() {
  const ts = new Date().toISOString();
  console.log(`${ts} [scheduler] 🔄 Repurposing approved content...`);
  try {
    const results = await repurposeApprovedContent();
    if (results.length > 0) {
      const channel = await client.channels.fetch(CHANNEL_ID);
      const embed = new EmbedBuilder()
        .setTitle(`🔄 Content Repurposed (${results.length})`)
        .setColor(0x9900ff)
        .setDescription(`Generated variants for email, LinkedIn, Twitter, TikTok, and more`)
        .setFooter({ text: "InsurgentForge • Content Repurposing" })
        .setTimestamp();
      await channel.send({
        content: `<@${OWNER_ID}> repurposed ${results.length} pieces → ready for multi-channel distribution`,
        embeds: [embed],
        allowedMentions: { users: [OWNER_ID] },
      });
    }
    console.log(`${new Date().toISOString()} [scheduler] ✅ repurposing complete`);
  } catch (e) {
    console.error(`${new Date().toISOString()} [scheduler] ❌ repurposing failed: ${e.message}`);
  }
}

async function runCronEmailSequences() {
  const ts = new Date().toISOString();
  console.log(`${ts} [scheduler] 📧 Launching email sequences...`);
  try {
    const launched = await launchSequencesForHighValueLeads();
    if (launched.length > 0) {
      const channel = await client.channels.fetch(CHANNEL_ID);
      const embed = new EmbedBuilder()
        .setTitle(`📧 ${launched.length} Email Sequence(s) Launched`)
        .setColor(0x00aaff)
        .setDescription(`4-email nurture sequences started for high-value leads`)
        .setFooter({ text: "InsurgentForge • Email Automation" })
        .setTimestamp();
      await channel.send({
        content: `<@${OWNER_ID}> launched ${launched.length} automated nurture sequences`,
        embeds: [embed],
        allowedMentions: { users: [OWNER_ID] },
      });
    }
    console.log(`${new Date().toISOString()} [scheduler] ✅ sequence launch complete`);
  } catch (e) {
    console.error(`${new Date().toISOString()} [scheduler] ❌ sequence launch failed: ${e.message}`);
  }
}

async function runCronCRMSync() {
  try {
    const dashboard = await getCRMDashboard();
    if (!dashboard) return;
    console.log(`[scheduler] CRM synced: ${dashboard.leads.high_value} high-value leads, ${dashboard.sequences.active} active sequences`);
  } catch (e) {
    console.error(`[scheduler] CRM sync failed: ${e.message}`);
  }
}

function setupCrons() {
  // Draft delivery: every 2 minutes — picks up any drafts created after bot started
  const deliverTask = cron.schedule("*/2 * * * *", async () => {
    try {
      await deliverPendingDrafts();
      await deliverContentDrafts();
    } catch (e) { console.error("[scheduler] deliver cron error:", e.message); }
  }, { name: "vanguard_deliver" });
  tasks.push(deliverTask);
  console.log("[scheduler] DELIVER cron: every 2 minutes");

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

  // Daily content generation: 3x per day (9:30 AM, 2:00 PM, 7:00 PM local time)
  const content930 = cron.schedule("30 9 * * *", runCronDailyContent, { name: "vanguard_content_930" });
  tasks.push(content930);
  const content200 = cron.schedule("0 14 * * *", runCronDailyContent, { name: "vanguard_content_200" });
  tasks.push(content200);
  const content700 = cron.schedule("0 19 * * *", runCronDailyContent, { name: "vanguard_content_700" });
  tasks.push(content700);
  console.log("[scheduler] DAILY content: 9:30 AM, 2:00 PM, 7:00 PM (local)");

  // Lead scoring: every hour (leads are time-sensitive)
  const leadTask = cron.schedule("0 * * * *", runCronLeadScoring, { name: "vanguard_leads" });
  tasks.push(leadTask);
  console.log("[scheduler] LEAD scoring: hourly");

  // Competitor tracking: daily at 8:00 AM
  const competitorTask = cron.schedule("0 8 * * *", runCronCompetitorTracking, { name: "vanguard_competitors" });
  tasks.push(competitorTask);
  console.log("[scheduler] COMPETITOR tracking: daily at 8:00 AM (local)");

  // Analytics report: Monday at 8:00 AM
  const analyticsTask = cron.schedule("0 8 * * 1", runCronWeeklyAnalytics, { name: "vanguard_analytics" });
  tasks.push(analyticsTask);
  console.log("[scheduler] WEEKLY analytics: Mondays at 8:00 AM (local)");

  // PHASE 2: Repurposing, Sequences, CRM

  // Content repurposing: every 6 hours
  const repurposeTask = cron.schedule("0 */6 * * *", runCronContentRepurposing, { name: "vanguard_repurpose" });
  tasks.push(repurposeTask);
  console.log("[scheduler] CONTENT repurposing: every 6 hours");

  // Email sequence launching: every 4 hours
  const sequenceTask = cron.schedule("0 */4 * * *", runCronEmailSequences, { name: "vanguard_sequences" });
  tasks.push(sequenceTask);
  console.log("[scheduler] EMAIL sequences: every 4 hours");

  // CRM sync: every hour
  const crmTask = cron.schedule("0 * * * *", runCronCRMSync, { name: "vanguard_crm" });
  tasks.push(crmTask);
  console.log("[scheduler] CRM sync: hourly");
}

// ── LIFECYCLE ────────────────────────────────────────────────────────────

async function ensureTablesExist() {
  try {
    // Create content_drafts table
    await query(`
      CREATE TABLE IF NOT EXISTS vg_content_drafts (
        id SERIAL PRIMARY KEY,
        topic TEXT,
        title TEXT NOT NULL,
        reddit TEXT,
        bluesky TEXT,
        mastodon TEXT,
        devto TEXT,
        twitter_draft TEXT,
        linkedin_draft TEXT,
        status VARCHAR(50) DEFAULT 'pending_approval',
        rejected_reason TEXT,
        published_platforms TEXT,
        created_at TIMESTAMP DEFAULT now(),
        delivered_at TIMESTAMP,
        approved_at TIMESTAMP,
        published_at TIMESTAMP
      )
    `);
    console.log("[scheduler] ✅ content_drafts table ready");

    // Create gmail_messages table for lead scoring
    await query(`
      CREATE TABLE IF NOT EXISTS gmail_messages (
        id SERIAL PRIMARY KEY,
        gmail_id VARCHAR(255) UNIQUE,
        from TEXT,
        subject TEXT,
        body TEXT,
        lead_score INT,
        lead_intent VARCHAR(50),
        lead_problem TEXT,
        lead_fit VARCHAR(50),
        received_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT now()
      )
    `);
    console.log("[scheduler] ✅ gmail_messages table ready");

    // Create market_signals table for competitor tracking
    await query(`
      CREATE TABLE IF NOT EXISTS vg_market_signals (
        id SERIAL PRIMARY KEY,
        source VARCHAR(50),
        title TEXT,
        sentiment VARCHAR(50),
        type VARCHAR(50),
        confidence INT,
        insight TEXT,
        url TEXT,
        created_at TIMESTAMP DEFAULT now(),
        UNIQUE(source, title)
      )
    `);
    console.log("[scheduler] ✅ market_signals table ready");

    // Create content_variants table for repurposing
    await query(`
      CREATE TABLE IF NOT EXISTS vg_content_variants (
        id SERIAL PRIMARY KEY,
        draft_id INT UNIQUE,
        variants JSONB,
        created_at TIMESTAMP DEFAULT now(),
        FOREIGN KEY (draft_id) REFERENCES vg_content_drafts(id)
      )
    `);
    console.log("[scheduler] ✅ content_variants table ready");

    // Create email_sequences table
    await query(`
      CREATE TABLE IF NOT EXISTS vg_email_sequences (
        id SERIAL PRIMARY KEY,
        lead_id INT,
        lead_email VARCHAR(255),
        sequence_type VARCHAR(50),
        status VARCHAR(50),
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP
      )
    `);
    console.log("[scheduler] ✅ email_sequences table ready");

    // Create email_sequence_steps table
    await query(`
      CREATE TABLE IF NOT EXISTS vg_email_sequence_steps (
        id SERIAL PRIMARY KEY,
        sequence_id INT,
        step_number INT,
        email_subject TEXT,
        email_body TEXT,
        send_after_days INT,
        status VARCHAR(50),
        sent_at TIMESTAMP,
        FOREIGN KEY (sequence_id) REFERENCES vg_email_sequences(id)
      )
    `);
    console.log("[scheduler] ✅ email_sequence_steps table ready");

    // Create CRM tables
    await query(`
      CREATE TABLE IF NOT EXISTS vg_crm_leads (
        id SERIAL PRIMARY KEY,
        email_id INT UNIQUE,
        email_address VARCHAR(255),
        lead_score INT,
        status VARCHAR(50),
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP
      )
    `);
    console.log("[scheduler] ✅ crm_leads table ready");

    await query(`
      CREATE TABLE IF NOT EXISTS vg_crm_content (
        id SERIAL PRIMARY KEY,
        draft_id INT UNIQUE,
        title TEXT,
        platforms TEXT,
        status VARCHAR(50),
        published_at TIMESTAMP
      )
    `);
    console.log("[scheduler] ✅ crm_content table ready");

    await query(`
      CREATE TABLE IF NOT EXISTS vg_crm_sales_pipeline (
        id SERIAL PRIMARY KEY,
        sequence_id INT UNIQUE,
        lead_email VARCHAR(255),
        stage VARCHAR(50),
        step_number INT,
        updated_at TIMESTAMP
      )
    `);
    console.log("[scheduler] ✅ crm_sales_pipeline table ready");
  } catch (e) {
    console.error("[scheduler] table creation error:", e.message);
  }
}

function startup() {
  console.log(`${new Date().toISOString()} [scheduler] 🚀 Vanguard starting up...`);
  ensureTablesExist();
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
