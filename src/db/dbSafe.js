const { ApiError } = require("../api/errors");
const { isDatabaseAvailable } = require("./client");

async function runDatabaseOp(operation) {
  if (!isDatabaseAvailable()) {
    throw new ApiError(
      503,
      "database_unavailable",
      "需要設定 DATABASE_URL 並確保 PostgreSQL 可連線",
      "internal"
    );
  }
  try {
    return await operation();
  } catch (error) {
    throw new ApiError(
      503,
      "database_unavailable",
      `資料庫連線失敗：${error.message}`,
      "internal",
      { code: error.code }
    );
  }
}

module.exports = {
  runDatabaseOp,
};
