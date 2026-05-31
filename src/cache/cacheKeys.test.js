#!/usr/bin/env node
const assert = require("assert");
const {
  normalizeAddress,
  inputCacheKey,
  manholeCacheKey,
  buildLookupKeys,
  buildWriteEntries,
} = require("./cacheKeys");

function testNormalizeCollapsesWhitespace() {
  const a = inputCacheKey(normalizeAddress("新祥街  6號"));
  const b = inputCacheKey(normalizeAddress("新祥街 6號"));
  assert.strictEqual(a, b);
}

function testLookupOrder() {
  const extraction = {
    manholeId: "FMH4017115",
    lampPostId: null,
    geocodeQueries: ["筲箕灣道260號"],
  };
  const keys = buildLookupKeys("FMH4017115 告警", extraction);
  assert.ok(keys[0].startsWith("input:"));
  assert.ok(keys.includes(manholeCacheKey("FMH4017115")));
  assert.ok(keys.some((k) => k.startsWith("addr:")));
}

function testWriteEntriesIncludeInputAndSemantic() {
  const extraction = {
    manholeId: "FMH4017115",
    geocodeQueries: ["筲箕灣道260號"],
  };
  const entries = buildWriteEntries(
    "FMH4017115",
    extraction,
    { kind: "manhole", geocodeQuery: "FMH4017115" },
    { status: "success", coordinate: { lat: 22.3, lng: 114.2 }, providerId: "manhole_registry" }
  );
  const kinds = new Set(entries.map((e) => e.kind));
  assert.ok(kinds.has("input"));
  assert.ok(kinds.has("manhole"));
}

function run() {
  testNormalizeCollapsesWhitespace();
  testLookupOrder();
  testWriteEntriesIncludeInputAndSemantic();
  console.log("cacheKeys.test.js: all passed");
}

run();
