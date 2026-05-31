const fs = require("fs");
const path = require("path");
const dns = require("dns").promises;

const addressCache = require("./cache/addressCache");
const { geocodeAddress } = require("./geocodeService");
const { createLogger } = require("./logger");
const { summarize, writeReports } = require("./reportWriter");
const { SOURCE_REGISTRY } = require("./sourceRegistry");

const addressesPath = path.join(__dirname, "..", "data", "restaurant-addresses.json");
const outputDir = path.join(__dirname, "..", "output");

function parseConcurrencyArg() {
  const flag = process.argv.find((arg) => arg.startsWith("--concurrency="));
  if (!flag) {
    return 5;
  }
  const value = Number(flag.split("=")[1]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 5;
}

function useCacheEnabled() {
  return !process.argv.includes("--no-cache");
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function runPreflight() {
  const checks = [];

  try {
    await dns.lookup("registry.npmjs.org");
    checks.push({ target: "registry.npmjs.org", status: "ok" });
  } catch (error) {
    checks.push({ target: "registry.npmjs.org", status: "failed", message: error.code || error.message });
  }

  try {
    await dns.lookup("www.als.gov.hk");
    checks.push({
      target: "www.als.gov.hk",
      status: "ok",
      note: "OGCIO Address Lookup Service",
      apiUrl: "https://www.als.gov.hk/lookup",
    });
  } catch (error) {
    checks.push({ target: "www.als.gov.hk", status: "failed", message: error.code || error.message });
  }

  try {
    await dns.lookup("www.map.gov.hk");
    checks.push({
      target: "www.map.gov.hk",
      status: "ok",
      note: "Lands Department location search API",
      apiUrl: "https://www.map.gov.hk/gs/api/v1.0.0/locationSearch",
    });
  } catch (error) {
    checks.push({ target: "www.map.gov.hk", status: "failed", message: error.code || error.message });
  }

  console.log(JSON.stringify({ mode: "preflight", checks }, null, 2));
}

async function main() {
  if (process.argv.includes("--preflight")) {
    await runPreflight();
    return;
  }

  if (process.argv.includes("--clear-cache")) {
    const removed = await addressCache.clearAll();
    console.log(`已清除 geocode 快取（${removed} 筆）。`);
  }

  const concurrency = parseConcurrencyArg();
  const useCache = useCacheEnabled();
  const sessionId = `batch-${Date.now()}`;
  const logger = createLogger({ sessionId });
  const addressEntries = JSON.parse(fs.readFileSync(addressesPath, "utf8"));

  logger.info("batch_start", {
    total: addressEntries.length,
    concurrency,
    useCache,
    cacheEntries: await addressCache.count(),
  });

  const startedAt = Date.now();
  const results = await mapWithConcurrency(addressEntries, concurrency, (entry) =>
    geocodeAddress(entry.address, {
      useCache,
      logger,
      entry,
    })
  );
  const elapsedMs = Date.now() - startedAt;

  const report = {
    generatedAt: new Date().toISOString(),
    packageName: "hk-address-parser-lib",
    runOptions: { concurrency, useCache, maxAttemptsPerAddress: 2 },
    elapsedMs,
    logDestination: logger.logToDb ? "postgresql:geocode_logs" : logger.logFilePath,
    cacheEntries: await addressCache.count(),
    sourceLegend: Object.fromEntries(
      Object.entries(SOURCE_REGISTRY).map(([label, meta]) => [
        meta.key,
        {
          dataSourceLabel: label,
          labelZh: meta.labelZh,
          labelEn: meta.labelEn,
          apiUrl: `${meta.apiBaseUrl}${meta.apiEndpoint}`,
          coordinateConversionApplied: meta.coordinateConversionApplied,
        },
      ])
    ),
    notes: [
      "Each result includes `source` (attribution) and `request` (cache/retry/failure metadata).",
      "request.requestFailed=true means both API attempts failed.",
      "request.fromCache=true means result was served from local cache.",
      "Logs are written to PostgreSQL geocode_logs (ts + log_date). Set LOG_TO_FILE=true only if you need file fallback.",
    ],
    summary: summarize(results),
    results,
  };

  const { jsonPath, csvPath } = writeReports({ outputDir, report });

  logger.info("batch_complete", {
    elapsedMs,
    summary: report.summary,
    jsonPath,
    csvPath,
  });

  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`JSON report: ${jsonPath}`);
  console.log(`CSV report:  ${csvPath}`);
  console.log(
    logger.logToDb
      ? `Logs:        PostgreSQL geocode_logs (session ${logger.sessionId})`
      : `Log file:    ${logger.logFilePath}`
  );
  console.log(`Cache entries: ${await addressCache.count()}`);
  console.log(`Completed ${results.length} addresses in ${elapsedMs}ms (concurrency=${concurrency})`);
}

main().catch((error) => {
  console.error(error.message);
  if (error.cause) {
    console.error(`Cause: ${error.cause.code || error.cause.message}`);
  }
  process.exit(1);
});
