#!/usr/bin/env node
require("./loadEnv").loadEnv();
const { geocodeAddress } = require("./geocodeService");
const { createLogger } = require("./logger");
const addressCache = require("./cache/addressCache");

function parseArgs(argv) {
  const options = {
    address: "",
    useCache: true,
    json: false,
    clearCache: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--no-cache") {
      options.useCache = false;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--clear-cache") {
      options.clearCache = true;
    } else if (arg === "--address" && argv[i + 1]) {
      options.address = argv[i + 1];
      i += 1;
    } else if (!arg.startsWith("-") && !options.address) {
      options.address = arg;
    }
  }

  return options;
}

function printHumanResult(result, logger) {
  console.log("");
  console.log("── 地址查詢結果 ──");
  console.log(`輸入地址: ${result.address}`);
  console.log(`狀態: ${result.status}`);
  console.log(`請求失敗: ${result.request?.requestFailed ? "是" : "否"}`);
  console.log(`嘗試次數: ${result.request?.attempts ?? 0} / ${result.request?.maxAttempts ?? 2}`);
  console.log(`來自快取: ${result.request?.fromCache ? "是" : "否"}`);
  if (result.request?.retried) {
    console.log("已重試: 是（共請求 2 次）");
  }
  if (result.request?.requestFailed && result.request?.errorMessage) {
    console.log(`失敗原因: ${result.request.errorMessage}`);
  }
  console.log(`Provider: ${result.providerId || result.routing?.selectedProvider || "-"}`);
  console.log(`分類: ${result.routing?.classifier || "-"} | hints: ${(result.routing?.hints || []).join(", ")}`);
  console.log(`資料來源: ${result.source?.labelZh || result.dataSource} (${result.source?.key || "unknown"})`);
  console.log(`API: ${result.source?.apiUrl || "-"}`);
  console.log(`座標: ${result.coordinate.lat}, ${result.coordinate.lng}`);
  if (result.matchedAddressZh) {
    console.log(`匹配地址(中): ${result.matchedAddressZh}`);
  }
  if (result.matchedAddressEn) {
    console.log(`匹配地址(英): ${result.matchedAddressEn}`);
  }
  if (result.geocodeQuery) {
    console.log(`實際查詢: ${result.geocodeQuery}`);
  }
  if (result.remarks?.length) {
    console.log(`備註: ${result.remarks.join("、")}`);
  }
  if (logger.logToDb) {
    console.log(`日誌: PostgreSQL geocode_logs（session: ${logger.sessionId}）`);
  } else if (logger.logFilePath) {
    console.log(`日誌檔案: ${logger.logFilePath}`);
  }
  console.log("");
}

async function main() {
  const options = parseArgs(process.argv);

  if (options.clearCache) {
    const removed = await addressCache.clearAll();
    console.log(`已清除 geocode 快取（${removed} 筆）。`);
    if (!options.address) {
      return;
    }
  }

  if (!options.address) {
    console.error("用法: npm run geocode -- \"香港中環皇后大道中15號\"");
    console.error("      npm run geocode -- --address \"地址\" [--no-cache] [--json] [--clear-cache]");
    process.exit(1);
  }

  const logger = createLogger({ sessionId: `cli-${Date.now()}` });
  logger.info("cli_start", { address: options.address, useCache: options.useCache });

  const result = await geocodeAddress(options.address, {
    useCache: options.useCache,
    logger,
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHumanResult(result, logger);
  }

  if (result.request?.requestFailed) {
    process.exit(2);
  }
  if (result.status === "no-match" || result.status === "no-coordinate") {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
