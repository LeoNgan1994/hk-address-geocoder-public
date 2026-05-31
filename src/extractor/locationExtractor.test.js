#!/usr/bin/env node
const assert = require("assert");
const { extractFromText } = require("./locationExtractor");

function test(name, fn) {
  try {
    fn();
    console.log(`ok ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error.message);
    process.exitCode = 1;
  }
}

const case1 =
  "Lane 801643 West Of Shek Kip Mei Street Alert signal was received from FMH4017115-DC202304-FS300 on 2026-05-22 02:54:36";
const case2 =
  "新祥街6號 6 SAN CHEUNG STREET 後巷 新祥街6號後巷後巷污水渠淤塞，請盡快跟進。";
const case3 =
  "筲箕灣道262號 筲箕灣道260-264號 寶文大廈 262 SHAU KEI WAN ROAD 260-264 SHAU KEI WAN ROAD Po Man Building 筲箕灣道260號寶文大廈後巷污水渠塞，要求跟進";

test("case1 extracts manhole FMH4017115", () => {
  const r = extractFromText(case1);
  assert.strictEqual(r.manholeId, "FMH4017115");
  assert.strictEqual(r.laneId, "801643");
  assert.ok(r.remarks.includes("West of"));
});

test("extracts SMH feat num", () => {
  const r = extractFromText("Locate manhole SMH7014545 sewer blockage");
  assert.strictEqual(r.manholeId, "SMH7014545");
});

test("case2 primary query is 新祥街6號 without 後巷", () => {
  const r = extractFromText(case2);
  assert.strictEqual(r.primaryGeocodeQuery, "新祥街6號");
  assert.ok(r.remarks.includes("後巷"));
  assert.ok(!r.primaryGeocodeQuery.includes("後巷"));
});

test("case3 prefers 筲箕灣道260 over 262", () => {
  const r = extractFromText(case3);
  assert.ok(r.geocodeQueries[0].includes("260"));
  assert.ok(!r.geocodeQueries[0].includes("262"));
  assert.ok(r.remarks.includes("後巷"));
});

test("geocode queries are deduped and ranked", () => {
  const r = extractFromText(case2);
  assert.ok(r.geocodeQueries.length >= 1);
  assert.strictEqual(r.geocodeQueries[0], "新祥街6號");
});

test("strips 投訴 prefix from complaint address", () => {
  const r = extractFromText(
    "HIP WO STREET 協和街 169 投訴協和街169號對出消防喉旁邊雨水渠道淤塞"
  );
  assert.ok(r.geocodeQueries.includes("協和街169號"));
  assert.ok(!r.geocodeQueries.some((q) => q.startsWith("投訴")));
});

test("parses spaced street number 福華街 182號", () => {
  const r = extractFromText(
    "福華街 182號 怡華閣 投訴福華街182號後巷污水渠淤塞"
  );
  assert.ok(r.geocodeQueries.includes("福華街182號"));
  assert.ok(r.buildingCues.includes("怡華閣"));
});

test("parses doorplate suffix 21C and 8A", () => {
  const soy = extractFromText("豉油街21C號 旺角豉油街21C");
  assert.ok(soy.geocodeQueries.includes("豉油街21C號"));

  const tai = extractFromText("西貢大網仔路8A側邊 投訴西貢大網仔路8A");
  assert.ok(tai.geocodeQueries.some((q) => q.includes("大網仔路8A")));
});

test("extracts village address 大水坑144號", () => {
  const r = extractFromText("投訴大水坑村144號側邊污水渠淤塞");
  assert.ok(r.geocodeQueries.some((q) => q.includes("大水坑村144號")));
});

test("includes building compound query for 荃新天地", () => {
  const r = extractFromText("楊屋道1號 荃新天地 投訴楊屋道1號荃新天地一期");
  assert.ok(r.buildingCues.some((b) => b.includes("新天地")));
  assert.ok(
    r.geocodeQueries.some(
      (q) => q.includes("楊屋道1號") && q.includes("新天地")
    )
  );
  assert.ok(!r.geocodeQueries.some((q) => /號號/.test(q)));
});

test("extracts 僑園 and builds compound query", () => {
  const r = extractFromText("界限街144號 僑園 投訴界限街144號僑園對出污水渠淤塞");
  assert.ok(r.buildingCues.includes("僑園"));
  assert.ok(r.geocodeQueries.includes("界限街144號僑園"));
  assert.ok(!r.geocodeQueries.some((q) => /號號/.test(q)));
});

test("extracts junction stall address 炮仗街57號", () => {
  const r = extractFromText(
    "炮仗街 PAU CHUNG STREET 馬頭角道與炮仗街交界綠色排檔57號旁 投訴馬頭角道與炮仗街交界綠色排檔57號旁的渠淤塞"
  );
  assert.ok(r.geocodeQueries.includes("炮仗街57號"));
  assert.ok(!r.geocodeQueries.some((q) => q.includes("角道與炮仗街")));
});

test("extracts manhole from alert text SMH4042116", () => {
  const r = extractFromText(
    "Lung Cheung Road, Wong Tai Sin Alert signal was received from SMH4042116-DC202304-W17 Locate at the manhole: SMH4042116"
  );
  assert.strictEqual(r.manholeId, "SMH4042116");
});

if (process.exitCode !== 1) {
  console.log("\nAll extractor tests passed.");
}
