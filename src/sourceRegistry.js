const { PROVIDER_IDS } = require("./providers/providerIds");

/** Maps hk-address-parser-lib dataSource() values to structured attribution metadata. */
const SOURCE_REGISTRY = {
  地政總署: {
    key: "lands_department",
    labelZh: "地政總署",
    labelEn: "Lands Department",
    agencyZh: "香港特別行政區政府地政總署",
    agencyEn: "Lands Department, HKSAR Government",
    apiBaseUrl: "https://www.map.gov.hk",
    apiEndpoint: "/gs/api/v1.0.0/locationSearch",
    coordinateSystem: "EPSG:4326 (WGS84)",
    coordinateConversionApplied: true,
    conversionNoteZh: "地政 API 回傳 EPSG:2326，套件以 proj4 轉為 WGS84",
    conversionNoteEn: "Lands API returns EPSG:2326; package converts to WGS84 via proj4",
  },
  資科辦: {
    key: "ogcio",
    labelZh: "資科辦（地址查詢服務）",
    labelEn: "OGCIO (Address Lookup Service)",
    agencyZh: "政府資訊科技總監辦公室",
    agencyEn: "Office of the Government Chief Information Officer",
    apiBaseUrl: "https://www.als.gov.hk",
    apiEndpoint: "/lookup",
    coordinateSystem: "EPSG:4326 (WGS84) when geospatial geo is present",
    coordinateConversionApplied: false,
    conversionNoteZh: "座標直接來自 OGCIO 地理資訊（若 API 有提供 geo）",
    conversionNoteEn: "Coordinates from OGCIO geospatial when geo field is present",
  },
};

/** Provider-key metadata (local DB and other non-API sources). */
const PROVIDER_SOURCE_REGISTRY = {
  [PROVIDER_IDS.LAMP_POST]: {
    key: PROVIDER_IDS.LAMP_POST,
    labelZh: "地政總署燈柱（UN）",
    labelEn: "LandsD Lamp Post (UN)",
    agencyZh: "地政總署 LPPUN SearchNumber API",
    agencyEn: "Lands Department LPPUN SearchNumber API",
    apiBaseUrl: "https://mapapi.geodata.gov.hk",
    apiEndpoint: "/gs/api/v1.0.0/lus/un/SearchNumber",
    coordinateSystem: "EPSG:4326 (WGS84)",
    coordinateConversionApplied: true,
    conversionNoteZh: "API 回傳 EPSG:2326，轉為 WGS84",
    conversionNoteEn: "API returns EPSG:2326, converted to WGS84",
    dataSourceLabel: "地政總署燈柱",
  },
};

const UNKNOWN_SOURCE = {
  key: "unknown",
  labelZh: "未知",
  labelEn: "Unknown",
  agencyZh: "",
  agencyEn: "",
  apiBaseUrl: "",
  apiEndpoint: "",
  coordinateSystem: "",
  coordinateConversionApplied: false,
  conversionNoteZh: "",
  conversionNoteEn: "",
};

function resolveSourceMeta(dataSourceLabel) {
  return SOURCE_REGISTRY[dataSourceLabel] || UNKNOWN_SOURCE;
}

function buildSourceAttribution(dataSourceLabel, hasCoordinate) {
  const meta = resolveSourceMeta(dataSourceLabel);
  return buildSourceFromMeta(meta, dataSourceLabel, hasCoordinate);
}

function buildSourceFromProviderKey(providerKey, hasCoordinate) {
  const meta = PROVIDER_SOURCE_REGISTRY[providerKey] || UNKNOWN_SOURCE;
  return buildSourceFromMeta(meta, meta.dataSourceLabel || "unknown", hasCoordinate, providerKey);
}

function buildSourceFromMeta(meta, dataSourceLabel, hasCoordinate, providerKey = meta.key) {
  return {
    key: providerKey || meta.key,
    labelZh: meta.labelZh,
    labelEn: meta.labelEn,
    agencyZh: meta.agencyZh,
    agencyEn: meta.agencyEn,
    apiUrl: meta.apiBaseUrl ? `${meta.apiBaseUrl}${meta.apiEndpoint}` : "",
    coordinateSystem: meta.coordinateSystem,
    coordinateConversionApplied: hasCoordinate && meta.coordinateConversionApplied,
    noteZh: hasCoordinate ? meta.conversionNoteZh : "未取得有效座標，無法確認轉換路徑",
    noteEn: hasCoordinate ? meta.conversionNoteEn : "No valid coordinate; conversion path not confirmed",
    dataSource: dataSourceLabel === "unknown" ? "unknown" : dataSourceLabel,
  };
}

module.exports = {
  SOURCE_REGISTRY,
  PROVIDER_SOURCE_REGISTRY,
  resolveSourceMeta,
  buildSourceAttribution,
  buildSourceFromProviderKey,
};

