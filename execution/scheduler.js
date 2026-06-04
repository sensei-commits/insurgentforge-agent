// SCHEDULER v2 — Lead Mining Engine
// Hunts for real Discord bot prospects across Reddit, GitHub, HN, Dev.to
require("dotenv").config();
const cron = require("node-cron");
const { Client, GatewayIntentBits } = require("discord.js");
const { query, pool } = require("./db");
const { mineSources, getTopLeads } = require("./lead-miner");
const { deliverLeadsToDiscord, deliverDailyDigest } = require("./lead-deliverer");

const OWNER_ID = process.env.DISCORD_OWNER_ID;
const CHANNEL_ID = process.env.DISCORD_TRENDS_CHANNEL_ID;
const ORCA = "🐋";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});
const tasks = [];

// ── BOT READY ────────────────────────────────────────────────────────────

let started = false;
async function onReady() {
  if (started) return;
  started = true;
  console.log(`\n${new Date().toISOString()} [scheduler] ${ORCA} Vanguard LEAD MINING ENGINE online`);
  console.log(`[scheduler] Scanning: Reddit, GitHub, HackerNews, Dev.to`);
  console.log(`[scheduler] Delivering leads to <#${CHANNEL_ID}>`);
}
client.once("ready", onReady);
client.once("clientReady", onReady);

// ── CRON JOBS ────────────────────────────────────────────────────────────

async function runCronLeadMining() {
  const ts = new Date().toISOString();
  console.log(`${ts} [scheduler] 🔍 Mining for leads...`);
  try {
    const newLeads = await mineSources();

    if (newLeads.length > 0) {
      await deliverLeadsToDiscord(client, CHANNEL_ID, OWNER_ID, newLeads);
      console.log(`${new Date().toISOString()} [scheduler] ✅ delivered ${newLeads.length} leads`);
    } else {
      console.log(`${new Date().toISOString()} [scheduler] ⏳ no new leads this run`);
    }
  } catch (e) {
    console.error(`${new Date().toISOString()} [scheduler] ❌ mining failed: ${e.message}`);
  }
}

async function runCronDailyDigest() {
  const ts = new Date().toISOString();
  console.log(`${ts} [scheduler] 📊 Generating daily digest...`);
  try {
    await deliverDailyDigest(client, CHANNEL_ID, OWNER_ID);
    console.log(`${new Date().toISOString()} [scheduler] ✅ digest sent`);
  } catch (e) {
    console.error(`${new Date().toISOString()} [scheduler] ❌ digest failed: ${e.message}`);
  }
}

function setupCrons() {
  // Lead mining: every 2 hours (Reddit, GitHub, HN, Dev.to)
  const miningTask = cron.schedule("0 */2 * * *", runCronLeadMining, { name: "vanguard_mining" });
  tasks.push(miningTask);
  console.log("[scheduler] LEAD MINING: every 2 hours");

  // Daily digest: 9:00 AM (top 10 leads from past 24h)
  const digestTask = cron.schedule("0 9 * * *", runCronDailyDigest, { name: "vanguard_digest" });
  tasks.push(digestTask);
  console.log("[scheduler] DAILY DIGEST: 9:00 AM (local)");
}

// ── STARTUP ──────────────────────────────────────────────────────────────

async function ensureTablesExist() {
  try {
    // Create mining_leads table
    await query(`
      CREATE TABLE IF NOT EXISTS vg_mining_leads (
        id SERIAL PRIMARY KEY,
        source VARCHAR(50),
        problem TEXT NOT NULL,
        current_solution TEXT,
        pain_points TEXT,
        scale TEXT,
        budget TEXT,
        urgency TEXT,
        email VARCHAR(255),
        discord VARCHAR(255),
        source_url TEXT,
        source_author VARCHAR(255),
        problem_hash VARCHAR(255),
        delivered_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT now()
      )
    `);
    console.log("[scheduler] ✅ mining_leads table ready");

    // Drop old tables if they exist (cleanup from old system)
    const oldTables = [
      "vg_content_drafts",
      "vg_content_variants",
      "vg_email_sequences",
      "vg_email_sequence_steps",
      "vg_crm_leads",
      "vg_crm_content",
      "vg_crm_sales_pipeline",
      "gmail_messages",
      "vg_market_signals",
      "vg_mining_leads", // Drop to recreate with new schema
    ];

    for (const table of oldTables) {
      try {
        await query(`DROP TABLE IF EXISTS ${table}`);
        console.log(`[scheduler] 🗑️ dropped old table: ${table}`);
      } catch (e) {
        // ignore if doesn't exist
      }
    }
  } catch (e) {
    console.error("[scheduler] table creation error:", e.message);
  }
}

function startup() {
  console.log(`${new Date().toISOString()} [scheduler] 🚀 Vanguard v2 starting up...`);
  ensureTablesExist();
  setupCrons();
}

client.on("ready", startup);

client.login(process.env.DISCORD_TOKEN);

process.on("SIGTERM", () => {
  console.log("[scheduler] shutting down gracefully...");
  tasks.forEach((t) => t.stop());
  pool.end();
  process.exit(0);
});
