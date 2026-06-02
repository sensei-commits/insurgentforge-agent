// PROBE: AI providers (DeepSeek, Groq, Gemini).
// Sends a 1-token "say OK" to each configured provider and confirms a response.
// Uses Node 18+ global fetch (no extra dependency).
const { ok, fail, warn, requireEnv } = require("./_env");

// Current, non-retired models (the old Helena Groq model mixtral-8x7b-32768 is decommissioned).
const TESTS = [
  {
    name: "DeepSeek (quality writer)",
    envKey: "DEEPSEEK_API_KEY",
    run: async (key) => {
      const r = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "user", content: "Reply with the single word: OK" }],
          max_tokens: 5,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${await r.text()}`);
      const d = await r.json();
      return d.choices?.[0]?.message?.content?.trim();
    },
  },
  {
    name: "Groq (fast/bulk)",
    envKey: "GROQ_API_KEY",
    run: async (key) => {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: "Reply with the single word: OK" }],
          max_tokens: 5,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${await r.text()}`);
      const d = await r.json();
      return d.choices?.[0]?.message?.content?.trim();
    },
  },
  {
    name: "Gemini (fallback)",
    envKey: "GEMINI_API_KEY",
    run: async (key) => {
      const url =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
        key;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Reply with the single word: OK" }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${await r.text()}`);
      const d = await r.json();
      return d.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    },
  },
];

async function probeAi() {
  console.log("\n— Probe: AI Providers —");
  let anyGreen = false;
  for (const t of TESTS) {
    if (!requireEnv([t.envKey])) {
      warn(`${t.name}: ${t.envKey} not set — skipping.`);
      continue;
    }
    try {
      const reply = await t.run(process.env[t.envKey]);
      if (reply) {
        ok(`${t.name} responded: "${reply}"`);
        anyGreen = true;
      } else {
        fail(`${t.name}: empty response.`);
      }
    } catch (err) {
      fail(`${t.name}: ${err.message}`);
    }
  }
  if (!anyGreen) warn("No AI provider responded. The writer needs at least one (ideally DeepSeek).");
  return anyGreen;
}

module.exports = { probeAi };
if (require.main === module) probeAi().then((pass) => { process.exitCode = pass ? 0 : 1; });
