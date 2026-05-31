const { isDatabaseAvailable, pingDatabase } = require("../db/client");

async function checkReadiness() {
  const checks = {};

  if (isDatabaseAvailable()) {
    checks.database = await pingDatabase();
  } else {
    checks.database = {
      ok: true,
      skipped: true,
      message: "DATABASE_URL not configured",
    };
  }

  const allOk = Object.values(checks).every((c) => c.ok || c.skipped);

  return {
    status: allOk ? "ready" : "not_ready",
    checks,
  };
}

module.exports = {
  checkReadiness,
};
