#!/usr/bin/env node
const assert = require("assert");
const {
  toPublicProviderId,
  mapPublicProviderList,
} = require("./publicProviderNames");

assert.strictEqual(toPublicProviderId("government_address"), "landsD");
assert.strictEqual(toPublicProviderId("lamp_post_registry"), "landsD");
assert.strictEqual(toPublicProviderId(null), null);
assert.deepStrictEqual(
  mapPublicProviderList(["government_address", "lamp_post_registry"]),
  ["landsD", "landsD"]
);

console.log("publicProviderNames.test.js: all passed");
