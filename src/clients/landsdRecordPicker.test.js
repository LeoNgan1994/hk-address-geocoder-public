#!/usr/bin/env node
const assert = require("assert");
const {
  pickBestLandRecord,
  buildSearchQueries,
  extractBuildingNames,
  filterRecordsByBuildingKeywords,
  applyStreetFirstPick,
} = require("./landsdRecordPicker");

const wtcContext = {
  geocodeQuery: "銅鑼灣告士打道280號",
  originalInput: "銅鑼灣告士打道280號世貿中心11樓1101號舖",
};

const wtcRecords = [
  {
    matchedAddressZh: "銅鑼灣告士打道280號",
    nameZH: "世貿中心",
    matchedAddressEn: "280,Gloucester Road",
    coordinate: { lat: 22.283083, lng: 114.181907 },
    _rankIndex: 0,
  },
  {
    matchedAddressZh: "銅鑼灣告士打道280號世貿中心5樓近P501舖",
    nameZH: "Wi-Fi.HK 熱點位置: 世貿中心011",
    matchedAddressEn: "Podium 5",
    coordinate: { lat: 22.28, lng: 114.18 },
    _rankIndex: 1,
  },
];

const oceanContext = {
  geocodeQuery: "尖沙嘴廣東道5號",
  originalInput: "尖沙嘴廣東道5號海港城海洋中心4樓403",
};

const oceanRecords = [
  {
    matchedAddressZh: "尖沙咀廣東道5號",
    nameZH: "",
    matchedAddressEn: "5,Canton Road",
    coordinate: { lat: 22.308629, lng: 114.168699 },
    _rankIndex: 0,
  },
  {
    matchedAddressZh: "尖沙咀廣東道5號",
    nameZH: "海洋中心",
    matchedAddressEn: "Ocean Centre",
    coordinate: { lat: 22.2948, lng: 114.1689 },
    _rankIndex: 1,
  },
  {
    matchedAddressZh: "尖沙咀廣東道5號海洋中心4樓403",
    nameZH: "某商戶",
    matchedAddressEn: "Unit 403",
    coordinate: { lat: 22.2945, lng: 114.1691 },
    _rankIndex: 2,
  },
];

const oceanBuildings = extractBuildingNames(oceanContext.originalInput);
assert.ok(oceanBuildings.includes("海港城海洋中心"));
assert.ok(oceanBuildings.includes("海港城"));
assert.ok(
  oceanBuildings.includes("海洋中心") ||
    oceanBuildings.some((n) => n.endsWith("海洋中心"))
);

const oceanQueries = buildSearchQueries(
  oceanContext.geocodeQuery,
  oceanContext.originalInput
);
assert.ok(oceanQueries.includes("尖沙嘴廣東道5號海洋中心"));
assert.ok(oceanQueries.includes("海洋中心"));
assert.ok(!oceanQueries.some((q) => /號號/.test(q)));

const poolOnly = filterRecordsByBuildingKeywords(oceanRecords, oceanBuildings);
assert.ok(poolOnly.some((r) => r.nameZH === "海洋中心"));
const poolPick = applyStreetFirstPick(poolOnly, oceanContext, {
  strategy: "street_pool_match",
  queries: ["尖沙嘴廣東道5號"],
});
assert.strictEqual(poolPick.best.nameZH, "海洋中心");

const { best: wtcBest } = pickBestLandRecord(wtcRecords, wtcContext);
assert.ok(wtcBest.matchedAddressZh.includes("280號"));
assert.ok(!String(wtcBest.nameZH || "").includes("Wi-Fi"));

const { best: oceanBest } = pickBestLandRecord(oceanRecords, oceanContext);
assert.strictEqual(oceanBest.nameZH, "海洋中心");

console.log("landsdRecordPicker.test.js: all passed");
