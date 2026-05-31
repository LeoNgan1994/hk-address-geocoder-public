const { Pool } = require("pg");

let pool = null;

/** PostgreSQL is configured (API keys, lamp_posts, migrations). */
function isDatabaseAvailable() {
  return Boolean(process.env.DATABASE_URL);
}

/** Geocode logs are written to DB only when DB is available and logging is on. */
function isLogToDbEnabled() {
  return isDatabaseAvailable() && process.env.LOG_TO_DB !== "false";
}

/** @deprecated use isDatabaseAvailable or isLogToDbEnabled */
function isDbEnabled() {
  return isDatabaseAvailable();
}

function getPool() {
  if (!isDatabaseAvailable()) {
    return null;
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX || 10),
    });
  }
  return pool;
}

async function query(text, params = []) {
  const activePool = getPool();
  if (!activePool) {
    return { rows: [], rowCount: 0 };
  }
  return activePool.query(text, params);
}

async function pingDatabase() {
  if (!isDatabaseAvailable()) {
    return { ok: false, message: "DATABASE_URL not configured" };
  }
  try {
    await query("SELECT 1 AS ok");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  isDatabaseAvailable,
  isLogToDbEnabled,
  isDbEnabled,
  getPool,
  query,
  pingDatabase,
  closePool,
};
