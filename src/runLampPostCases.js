#!/usr/bin/env node
require("./loadEnv").loadEnv();
const { geocodeAddress } = require("./geocodeService");
const { createLogger } = require("./logger");

const IDS = ["GD3840", "EB0580", "VA8365"];

async function main() {
  const logger = createLogger({ sessionId: `lamp-${Date.now()}` });
  let failed = 0;

  for (const id of IDS) {
    const text = `燈柱 ${id}`;
    const result = await geocodeAddress(text, { useCache: false, logger });
    const ok =
      result.status === "success" &&
      result.providerId === "lamp_post_registry" &&
      result.coordinate?.lat !== 0;

    console.log(
      JSON.stringify({
        id,
        ok,
        provider: result.providerId,
        lat: result.coordinate?.lat,
        lng: result.coordinate?.lng,
        matched: result.matchedAddressZh,
      })
    );

    if (!ok) {
      failed += 1;
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
