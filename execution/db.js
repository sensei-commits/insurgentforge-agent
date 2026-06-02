// TOOL: database access (implements SOP-01).
// Thin wrapper around a pg Pool. Every other tool imports { query, pool } from here.
require("dotenv").config();
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Cannot start the data layer.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

// Run a parameterized query. ALWAYS use params ($1, $2) — never string-concat values.
async function query(text, params = []) {
  return pool.query(text, params);
}

module.exports = { pool, query };
