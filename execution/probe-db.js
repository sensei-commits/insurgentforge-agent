// PROBE: Railway Postgres connection.
// Confirms we can connect and run a trivial query. No tables required yet.
const { Client } = require("pg");
const { ok, fail, warn, requireEnv } = require("./_env");

async function probeDb() {
  console.log("\n— Probe: PostgreSQL (Railway) —");
  if (!requireEnv(["DATABASE_URL"])) {
    fail("DATABASE_URL not set. Get it from Railway → Postgres → Connect.");
    return false;
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    // Railway external connections require SSL; internal ones don't.
    ssl: process.env.DATABASE_URL.includes("localhost")
      ? false
      : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const res = await client.query("SELECT version();");
    ok(`Connected. ${res.rows[0].version.split(",")[0]}`);
    return true;
  } catch (err) {
    fail(`Could not connect: ${err.message}`);
    warn("Check the connection string, and that you're using the PUBLIC URL if running locally.");
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

module.exports = { probeDb };
if (require.main === module) probeDb().then((pass) => { process.exitCode = pass ? 0 : 1; });
