// TOOL: AI routing layer (implements SOP-02).
// think() = quality path (DeepSeek first). quick() = cheap/fast path (Groq first).
// Each falls back through the chain; throws only if EVERY provider fails.
require("dotenv").config();

const PROVIDERS = {
  deepseek: {
    key: () => process.env.DEEPSEEK_API_KEY,
    model: "deepseek-chat",
    endpoint: "https://api.deepseek.com/chat/completions",
    style: "openai",
  },
  groq: {
    key: () => process.env.GROQ_API_KEY,
    model: "llama-3.3-70b-versatile",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    style: "openai",
  },
  gemini: {
    key: () => process.env.GEMINI_API_KEY,
    model: "gemini-2.0-flash",
    endpoint:
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    style: "gemini",
  },
};

// OpenAI-compatible call (DeepSeek, Groq).
async function callOpenAiStyle(p, { system, prompt, maxTokens, temperature }) {
  const r = await fetch(p.endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${p.key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: p.model,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt },
      ],
      max_tokens: maxTokens || 1200,
      temperature: temperature ?? 0.7,
    }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const text = d.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("empty response");
  return text;
}

// Gemini call.
async function callGemini(p, { system, prompt, maxTokens, temperature }) {
  const r = await fetch(`${p.endpoint}?key=${p.key()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: system ? { parts: [{ text: system }] } : undefined,
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens || 1200, temperature: temperature ?? 0.7 },
    }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error("empty response");
  return text;
}

async function callProvider(name, opts) {
  const p = PROVIDERS[name];
  if (!p || !p.key()) throw new Error(`${name}: no API key`);
  return p.style === "gemini" ? callGemini(p, opts) : callOpenAiStyle(p, opts);
}

// Run a chain of providers in order; return first success.
async function runChain(chain, opts) {
  const errors = [];
  for (const name of chain) {
    if (!PROVIDERS[name]?.key()) continue; // skip unconfigured
    try {
      const text = await callProvider(name, opts);
      console.log(`[AI] ✅ ${name} answered`);
      return { text, provider: name };
    } catch (err) {
      console.warn(`[AI] ⚠️ ${name} failed: ${err.message}`);
      errors.push(`${name}: ${err.message}`);
    }
  }
  throw new Error(`All AI providers failed → ${errors.join(" | ")}`);
}

// Quality path — for writing & reasoning.
function think(opts) {
  return runChain(["deepseek", "groq", "gemini"], opts);
}

// Cheap/fast path — for classify/summarize/bulk.
function quick(opts) {
  return runChain(["groq", "deepseek", "gemini"], opts);
}

module.exports = { think, quick, runChain };
