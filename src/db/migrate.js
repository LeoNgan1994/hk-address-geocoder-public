const fs = require("fs");
const path = require("path");
const { isDatabaseAvailable, query } = require("./client");

async function runMigrations() {
  if (!isDatabaseAvailable()) {
    return { skipped: true, reason: "DATABASE_URL not set" };
  }

  try {
    const schemaPath = path.join(__dirname, "..", "..", "db", "schema.sql");
    const sql = fs.readFileSync(schemaPath, "utf8");
    await query(sql);
    await query("DROP TABLE IF EXISTS manholes");
    await query("ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS daily_quota INTEGER");
    await query("ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS rate_limit_per_minute INTEGER");
    return { skipped: false };
  } catch (error) {
    return { skipped: true, failed: true, reason: error.message };
  }
}

module.exports = {
  runMigrations,
};
