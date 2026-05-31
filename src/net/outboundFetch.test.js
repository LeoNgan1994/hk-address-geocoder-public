#!/usr/bin/env node
const assert = require("assert");
const { validateOutboundConfig } = require("./outboundFetch");

test("validateOutboundConfig passes without proxy", () => {
  const result = validateOutboundConfig({ enabled: false, undiciOk: true, globalAgentOk: true });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.proxyEnabled, false);
});

console.log("outboundFetch.test.js: all passed");
