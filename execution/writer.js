// TOOL: content writer + voice check + refusal gate (implements SOP-04).
// Turns a vg_trends opportunity into a platform-tailored draft, gated for safety + voice.
require("dotenv").config();
const { think, quick } = require("./ai");
const { query } = require("./db");

// ── Voice profile injected into every generation ────────────────────────────
const VOICE = `You ARE @iNFAMOUSII8, founder of InsurgentForge — a real builder talking to fellow builders.
Voice: super casual peer-to-peer, first person, genuine, humorous. Relaxed punctuation like you're
texting a friend (fewer periods, more flow). No corporate polish. Naturally excited about Discord bots & AI.
BUSINESS: the core angle is always cost-cutting — people overpay for bloated bots that do 1/10 of what
they need. You build custom solutions that cost less and do exactly what the client wants. Never say
"lean custom build" — that's a cliché. Say it different each time. Frame as "there's a cheaper way that
actually works better" never "X is garbage". Give real, concrete value.
Hard bans: no AI cliches (dive in, game-changer, unlock, elevate, supercharge, revolutionize, seamless,
"in conclusion", "look no further", "hit me", "hit me up"), no emoji-stuffing, no hashtag soup, no begging for follows.
Each post should sound authentically different from the last. Vary closing lines — never repeat the same
sign-off twice.`;

// ── Refusal gate ────────────────────────────────────────────────────────────
const REFUSAL_PATTERNS = [
  { re: /\b(election|democrat|republican|biden|trump|congress|abortion|immigration policy)\b/i, reason: "politics" },
  { re: /\b(drama|cancel(l)?ed|controvers|callout|beef with|expose[ds]?)\b/i, reason: "drama/controversy" },
  { re: /\b(church|bible|quran|allah|jesus|religio|gospel|prayer)\b/i, reason: "religion" },
  { re: /\b(free nitro|airdrop|crypto pump|guaranteed money|click here to claim|giveaway scam)\b/i, reason: "scam/spam" },
];

async function refusalCheck(trend) {
  const text = `${trend.title} ${trend.summary || ""}`;
  // 1) deterministic
  for (const p of REFUSAL_PATTERNS) {
    if (p.re.test(text)) return { blocked: true, reason: p.reason };
  }
  // 2) AI grey-area check (cheap, HIGH-PRECISION — must not over-block legit tech topics)
  try {
    const { text: verdict } = await quick({
      system: `You screen Discord-bot/tech marketing topics. Reply with ONE word only: BLOCK or OK.
BLOCK ONLY if the CORE topic is clearly about: real-world politics, religion, interpersonal
drama/controversy, or a financial scam/fraud scheme. Normal software, bots, tools, games, and tech
are ALWAYS OK — even if a project NAME sounds unusual (e.g. "mine", "nuke", "kill"). When uncertain, reply OK.`,
      prompt: `Topic: "${trend.title}". Summary: "${trend.summary || "a Discord bot project"}". One word:`,
      maxTokens: 3,
      temperature: 0,
    });
    if (/^\s*block\b/i.test(verdict)) {
      return { blocked: true, reason: "flagged by safety check (review manually)" };
    }
  } catch {
    /* if AI check fails, fall through — deterministic gate already passed */
  }
  return { blocked: false, reason: null };
}

// ── Voice check ─────────────────────────────────────────────────────────────
const CLICHES = [
  "dive in", "game-changer", "game changer", "unlock", "elevate", "supercharge",
  "revolutionize", "seamless", "in today's fast-paced world", "in conclusion",
  "look no further", "the world of", "say goodbye to", "in the realm of", "leverage",
  "hit me up", "hit me",
];

function findCliches(text) {
  const lower = text.toLowerCase();
  return CLICHES.filter((c) => lower.includes(c));
}

function normalize(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 3);
}

function overlap(a, b) {
  const sa = new Set(normalize(a));
  const sb = new Set(normalize(b));
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  return inter / Math.min(sa.size, sb.size);
}

async function dedupCheck(body, platform) {
  const { rows } = await query(
    `SELECT id, body FROM vg_drafts WHERE platform=$1 ORDER BY created_at DESC LIMIT 20`,
    [platform]
  );
  for (const r of rows) {
    if (overlap(body, r.body) > 0.6) return r.id;
  }
  return null;
}

// ── Platform specs ──────────────────────────────────────────────────────────
const SPECS = {
  bluesky:   { title: false, max: 300,  shape: "punchy 1-2 lines" },
  mastodon:  { title: false, max: 500,  shape: "punchy, dev-friendly" },
  devto:     { title: true,  max: 4000, shape: "markdown article, technical, evergreen" },
  reddit:    { title: true,  max: 4000, shape: "value-first, NO self-promo (warm-up)" },
  twitter:   { title: false, max: 280,  shape: "punchy hook" },
  linkedin:  { title: false, max: 700,  shape: "polished but warm, B2B" },
  instagram: { title: false, max: 500,  shape: "visual caption" },
};
const PASTE_ONLY = ["twitter", "linkedin", "instagram"];

// ── Generation ──────────────────────────────────────────────────────────────
async function generate(trend, platform, spec, { avoidCliches = [] } = {}) {
  const titleLine = spec.title ? "Return a TITLE line, then a blank line, then the BODY." : "Return ONLY the post text.";
  const avoid = avoidCliches.length ? `\nDo NOT use these phrases: ${avoidCliches.join(", ")}.` : "";
  const { text } = await think({
    system: VOICE,
    prompt:
      `Write a ${platform} post (${spec.shape}, max ~${spec.max} chars) about this opportunity:\n` +
      `"${trend.title}" — ${trend.summary || "(cost-cutting opportunity in the Discord-bot niche)"}\n` +
      `Cost-saving angle: ${trend.cost_saving_angle || "people overpay for bloated bots"}\n` +
      `CRITICAL: sound AUTHENTIC and HUMAN. Use casual punctuation (fewer periods, more flow). ` +
      `NO em-dashes (—). Keep it like texting a friend. Never say "lean custom build" — say it different every time. VARY your phrasing. ` +
      `This post should NOT sound like the last one you wrote.` +
      `${titleLine}${avoid}\nNo hashtags unless natural. No preamble.`,
    maxTokens: spec.title ? 700 : 220,
    temperature: 0.85,
  });
  return text.trim();
}

function cleanTitle(s) {
  // strip leading markdown heading marks and any echoed "TITLE:" / "Title -" label
  return s.replace(/^#+\s*/, "").replace(/^title\s*[:\-]\s*/i, "").trim();
}

function splitTitleBody(raw, hasTitle) {
  if (!hasTitle) return { title: null, body: raw };
  const idx = raw.indexOf("\n");
  if (idx === -1) return { title: cleanTitle(raw).slice(0, 120), body: raw };
  return { title: cleanTitle(raw.slice(0, idx)).slice(0, 200), body: raw.slice(idx).trim() };
}

/**
 * Create a draft for one platform. Stores in vg_drafts. Returns the draft object.
 */
async function writeDraft({ trend, platform }) {
  const spec = SPECS[platform];
  if (!spec) throw new Error(`Unknown platform: ${platform}`);

  // 1) refusal gate
  const refusal = await refusalCheck(trend);
  if (refusal.blocked) {
    const { rows } = await query(
      `INSERT INTO vg_drafts (trend_id, platform, title, body, refusal, status)
       VALUES ($1,$2,$3,$4,$5,'rejected') RETURNING id`,
      [trend.id || null, platform, null, "(blocked — not generated)", refusal]
    );
    return { id: rows[0].id, platform, refusal, status: "rejected", blocked: true };
  }

  // 2) generate
  let raw = await generate(trend, platform, spec);
  let cliches = findCliches(raw);
  // 3) one automatic rewrite if cliches slipped in
  if (cliches.length) {
    raw = await generate(trend, platform, spec, { avoidCliches: cliches });
    cliches = findCliches(raw);
  }

  const { title, body } = splitTitleBody(raw, spec.title);

  // dedup check
  const duplicateOf = await dedupCheck(body, platform);

  const voice_check = {
    sounds_human: cliches.length === 0,
    ai_cliches_found: cliches,
    duplicate_of: duplicateOf,
  };
  const status = PASTE_ONLY.includes(platform) ? "manual" : "pending_approval";

  const { rows } = await query(
    `INSERT INTO vg_drafts (trend_id, platform, title, body, voice_check, refusal, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [trend.id || null, platform, title, body, voice_check, refusal, status]
  );

  return { id: rows[0].id, platform, title, body, voice_check, refusal, status, blocked: false };
}

module.exports = { writeDraft, refusalCheck, findCliches, SPECS, PASTE_ONLY };
