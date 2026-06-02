// Shared helper: load .env and provide small probe utilities.
// Keeps every probe script consistent and dependency-light.
require("dotenv").config();

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

function ok(msg) {
  console.log(`${GREEN}✅ ${msg}${RESET}`);
}
function fail(msg) {
  console.log(`${RED}❌ ${msg}${RESET}`);
}
function warn(msg) {
  console.log(`${YELLOW}⚠️  ${msg}${RESET}`);
}

// Returns true if every listed env var is present & non-empty.
function requireEnv(keys) {
  const missing = keys.filter((k) => !process.env[k] || process.env[k].trim() === "");
  if (missing.length) {
    warn(`Missing/empty in .env: ${missing.join(", ")}`);
    return false;
  }
  return true;
}

module.exports = { ok, fail, warn, requireEnv };
