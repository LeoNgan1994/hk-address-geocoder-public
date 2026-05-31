#!/usr/bin/env node
const assert = require("assert");
const { hk1980ToWgs84 } = require("./projConvert");

// LandsD portal reference for 告士打道280號 / 世貿中心 (HK1980 E 837000, N 815890)
const { lat, lng } = hk1980ToWgs84(837000, 815890);
assert.ok(Math.abs(lat - 22.28189) < 0.0001, `lat ${lat}`);
assert.ok(Math.abs(lng - 114.18398) < 0.0001, `lng ${lng}`);

console.log("projConvert.test.js: all passed");
