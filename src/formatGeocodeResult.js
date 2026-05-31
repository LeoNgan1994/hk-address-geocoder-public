const { buildSourceAttribution, buildSourceFromProviderKey } = require("./sourceRegistry");
const { PROVIDER_IDS } = require("./providers/providerIds");

function normalizeCoordinate(record) {
  if (!record || typeof record.coordinate !== "function") {
    return { lat: 0, lng: 0 };
  }

  const coordinate = record.coordinate() || { lat: 0, lng: 0 };
  return {
    lat: Number(coordinate.lat || 0),
    lng: Number(coordinate.lng || 0),
  };
}

function detectSourceLabel(record) {
  if (!record || typeof record.dataSource !== "function") {
    return "unknown";
  }

  try {
    return record.dataSource() || "unknown";
  } catch {
    return "unknown";
  }
}

function readConfidence(record) {
  if (!record || typeof record.confidence !== "function") {
    return null;
  }

  try {
    return record.confidence();
  } catch (error) {
    return { error: error.message };
  }
}

function buildAssessment(sourceKey, hasCoordinate) {
  if (!hasCoordinate) {
    return "no-coordinate-returned";
  }
  if (sourceKey === "lands_department") {
    return "land-department-coordinate-with-epsg2326-conversion";
  }
  if (sourceKey === "ogcio") {
    return "ogcio-geospatial-coordinate";
  }
  return "coordinate-returned-source-undetermined";
}

function formatMatchResult(entry, topMatch, matchCount, languages) {
  const coordinate = normalizeCoordinate(topMatch);
  const dataSourceLabel = detectSourceLabel(topMatch);
  const hasCoordinate = coordinate.lat !== 0 && coordinate.lng !== 0;
  const source = buildSourceAttribution(dataSourceLabel, hasCoordinate);

  let status = "no-match";
  if (topMatch) {
    status = hasCoordinate ? "success" : "no-coordinate";
  }

  return {
    ...entry,
    status,
    providerId: PROVIDER_IDS.GOVERNMENT,
    precision: hasCoordinate ? "building" : "unknown",
    matchCount,
    matchedAddressZh:
      topMatch && typeof topMatch.fullAddress === "function"
        ? topMatch.fullAddress(languages.zh)
        : "",
    matchedAddressEn:
      topMatch && typeof topMatch.fullAddress === "function"
        ? topMatch.fullAddress(languages.en)
        : "",
    dataSource: source.dataSource,
    source,
    confidence: topMatch ? readConfidence(topMatch) : null,
    coordinate,
    assessment: buildAssessment(source.key, hasCoordinate),
  };
}

function formatErrorResult(entry, error) {
  const source = buildSourceAttribution("unknown", false);
  const message = error && error.message ? error.message : "Unknown error";
  return {
    ...entry,
    status: "error",
    matchCount: 0,
    matchedAddressZh: "",
    matchedAddressEn: "",
    dataSource: "unknown",
    source,
    confidence: null,
    coordinate: { lat: 0, lng: 0 },
    assessment: "query-error",
    errorMessage: message,
  };
}

function formatLampPostResult(entry, lampPostRecord, acquisitionMode = "database") {
  const coordinate = {
    lat: Number(lampPostRecord.lat),
    lng: Number(lampPostRecord.lng),
  };
  const hasCoordinate = coordinate.lat !== 0 && coordinate.lng !== 0;
  const source = buildSourceFromProviderKey(PROVIDER_IDS.LAMP_POST, hasCoordinate);
  if (acquisitionMode === "api") {
    source.noteZh = "座標來自燈柱 API";
    source.noteEn = "Coordinates from lamp post API";
  } else {
    source.noteZh = "座標來自資料庫燈柱對照表";
    source.noteEn = "Coordinates from lamp post database registry";
  }
  source.acquisitionMode = acquisitionMode;
  const matchedAddressZh = [lampPostRecord.road_zh, `燈柱 ${lampPostRecord.lamp_post_id}`]
    .filter(Boolean)
    .join(" ");
  const matchedAddressEn = [lampPostRecord.road_en, `Lamppost ${lampPostRecord.lamp_post_id}`]
    .filter(Boolean)
    .join(", ");

  return {
    ...entry,
    status: hasCoordinate ? "success" : "no-coordinate",
    matchCount: 1,
    matchedAddressZh,
    matchedAddressEn,
    dataSource: source.dataSource,
    source,
    providerId: PROVIDER_IDS.LAMP_POST,
    precision: "point",
    matchType: `lamp_post_${lampPostRecord.lamp_post_id}`,
    confidence: 1,
    coordinate,
    assessment: hasCoordinate ? "lamp-post-registry-coordinate" : "no-coordinate-returned",
    dataAcquisition: acquisitionMode,
  };
}

function formatNoMatchResult(entry) {
  const source = buildSourceAttribution("unknown", false);
  return {
    ...entry,
    status: "no-match",
    matchCount: 0,
    matchedAddressZh: "",
    matchedAddressEn: "",
    dataSource: "unknown",
    source,
    confidence: null,
    coordinate: { lat: 0, lng: 0 },
    assessment: "no-results-returned",
  };
}

/** LandsD locationSearch via native fetch (UAT proxy path). */
function formatGovernmentLandsdMatch(entry, record, matchCount) {
  const coordinate = record.coordinate || { lat: 0, lng: 0 };
  const hasCoordinate = coordinate.lat !== 0 && coordinate.lng !== 0;
  const source = buildSourceAttribution("地政總署", hasCoordinate);
  source.acquisitionMode = "api";
  source.noteZh = "地政總署 locationSearch（native fetch + proxy）";
  source.noteEn = "Lands Department locationSearch (native fetch + proxy)";

  return {
    ...entry,
    status: hasCoordinate ? "success" : "no-coordinate",
    providerId: PROVIDER_IDS.GOVERNMENT,
    precision: hasCoordinate ? "building" : "unknown",
    matchCount,
    matchedAddressZh: record.matchedAddressZh || "",
    matchedAddressEn: record.matchedAddressEn || "",
    dataSource: source.dataSource,
    source,
    confidence: record.score != null ? { score: record.score } : null,
    coordinate,
    coordinateHk1980: record.coordinateHk1980 || null,
    assessment: buildAssessment(source.key, hasCoordinate),
    dataAcquisition: "api",
  };
}

module.exports = {
  formatMatchResult,
  formatGovernmentLandsdMatch,
  formatLampPostResult,
  formatErrorResult,
  formatNoMatchResult,
};
