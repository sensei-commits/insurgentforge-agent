# SOP-02 — AI Routing

**Layer:** A (Architecture) — defines how `ai.js` picks models.
**Golden Rule:** if routing changes, update this doc first.

## Goal
Give Vanguard intelligence while honoring the core invariant: **ultra budget-friendly + super
intelligent.** Route each task to the cheapest model that can do it well, with automatic fallback.

## Available providers (verified Phase L)
| provider | model | role | cost | status |
|---|---|---|---|---|
| DeepSeek | deepseek-chat | quality writing & reasoning | paid, pennies | ✅ green |
| Groq | llama-3.3-70b-versatile | fast/bulk classify, summarize | free | ✅ green |
| Gemini | gemini-2.0-flash | last-resort fallback | free | ⚠️ quota=0 (key issue) |

> NOTE: the old Helena Groq model `mixtral-8x7b-32768` is RETIRED. We use `llama-3.3-70b-versatile`.

## Two entry points
- **`think(...)`** — quality path. Order: DeepSeek → Groq → Gemini.
  Use for: writing posts in brand voice, summarizing "why a trend matters", cost-saving angles.
- **`quick(...)`** — cheap/fast path. Order: Groq → DeepSeek → Gemini.
  Use for: classifying signal types, dedup checks, short yes/no calls, bulk passes.

## Rules
1. Skip any provider whose API key is missing/empty.
2. On error (non-2xx, timeout, empty), log a warning and fall to the next provider.
3. If ALL providers fail, throw — callers must handle (never silently fabricate output).
4. Always return `{ text, provider }` so logs show who answered (cost transparency).
5. DeepSeek (paid) is used only on the `think` path → keeps spend on quality-critical work only.

## Self-healing note
- If DeepSeek starts failing, `think` degrades to Groq automatically (quality dips, system lives).
- Gemini currently has no quota; it stays in the chain as a no-op-until-fixed safety net.
  TODO: refresh Gemini key OR swap in OpenRouter (Helena already had OpenRouter support).
