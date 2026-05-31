const fs = require("fs");
const path = require("path");

function summarizeBySource(results) {
  const bySource = {};

  for (const item of results) {
    const key = item.source?.key || "unknown";
    if (!bySource[key]) {
      bySource[key] = {
        key,
        labelZh: item.source?.labelZh || "未知",
        count: 0,
        withCoordinate: 0,
      };
    }
    bySource[key].count += 1;
    if (item.coordinate?.lat !== 0 && item.coordinate?.lng !== 0) {
      bySource[key].withCoordinate += 1;
    }
  }

  return Object.values(bySource);
}

function summarize(results) {
  const summary = {
    total: results.length,
    successCount: 0,
    noMatchCount: 0,
    noCoordinateCount: 0,
    coordinateCount: 0,
    landDepartmentCount: 0,
    ogcioCount: 0,
    errorCount: 0,
    bySource: summarizeBySource(results),
  };

  summary.cacheHitCount = 0;
  summary.requestFailedCount = 0;
  summary.retriedCount = 0;

  for (const item of results) {
    if (item.status === "success") summary.successCount += 1;
    if (item.status === "no-match") summary.noMatchCount += 1;
    if (item.status === "no-coordinate") summary.noCoordinateCount += 1;
    if (item.status === "error") summary.errorCount += 1;
    if (item.request?.fromCache) summary.cacheHitCount += 1;
    if (item.request?.requestFailed) summary.requestFailedCount += 1;
    if (item.request?.retried) summary.retriedCount += 1;
    if (item.coordinate?.lat !== 0 && item.coordinate?.lng !== 0) {
      summary.coordinateCount += 1;
    }
    if (item.dataSource === "地政總署") summary.landDepartmentCount += 1;
    if (item.dataSource === "資科辦") summary.ogcioCount += 1;
  }

  return summary;
}

function escapeCsvCell(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsvRow(item) {
  return [
    item.id,
    item.restaurantName,
    item.address,
    item.status,
    item.request?.requestFailed,
    item.request?.fromCache,
    item.request?.attempts,
    item.request?.retried,
    item.dataSource,
    item.source?.key,
    item.source?.labelZh,
    item.source?.labelEn,
    item.source?.agencyZh,
    item.source?.apiUrl,
    item.source?.coordinateSystem,
    item.source?.coordinateConversionApplied,
    item.source?.noteZh,
    item.matchedAddressZh,
    item.matchedAddressEn,
    item.coordinate?.lat,
    item.coordinate?.lng,
    item.matchCount,
    item.assessment,
    item.request?.errorMessage || item.errorMessage || "",
  ]
    .map(escapeCsvCell)
    .join(",");
}

const CSV_HEADERS = [
  "id",
  "restaurantName",
  "inputAddress",
  "status",
  "requestFailed",
  "fromCache",
  "attempts",
  "retried",
  "dataSource",
  "sourceKey",
  "sourceLabelZh",
  "sourceLabelEn",
  "sourceAgencyZh",
  "sourceApiUrl",
  "coordinateSystem",
  "coordinateConversionApplied",
  "sourceNoteZh",
  "matchedAddressZh",
  "matchedAddressEn",
  "lat",
  "lng",
  "matchCount",
  "assessment",
  "errorMessage",
].join(",");

function writeReports({ outputDir, report }) {
  fs.mkdirSync(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, "coordinate-test-report.json");
  const csvPath = path.join(outputDir, "coordinate-test-report.csv");

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const csvLines = [CSV_HEADERS, ...report.results.map(buildCsvRow)];
  fs.writeFileSync(csvPath, `${csvLines.join("\n")}\n`, "utf8");

  return { jsonPath, csvPath };
}

module.exports = {
  summarize,
  writeReports,
};
