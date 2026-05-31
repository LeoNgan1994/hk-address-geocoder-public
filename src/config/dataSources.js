const { PROVIDER_IDS } = require("../providers/providerIds");

function parseAcquisitionOrder(envValue, fallback = ["api", "database"]) {
  if (!envValue) {
    return fallback;
  }
  return envValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Registry of provider data acquisition strategies.
 */
const DATA_SOURCE_REGISTRY = {
  [PROVIDER_IDS.LAMP_POST]: {
    providerId: PROVIDER_IDS.LAMP_POST,
    labelZh: "燈柱",
    descriptionZh: "燈柱編號，如 GD3840（LandsD UN SearchNumber 或本地表）",
    acquisitionOrder: () =>
      parseAcquisitionOrder(process.env.LAMP_POST_ACQUISITION_ORDER, ["api"]),
    modes: {
      api: {
        enabled: () =>
          process.env.LAMP_POST_LANDSD_ENABLED !== "false" ||
          Boolean(process.env.LAMP_POST_API_URL),
        envKeys: [
          "LAMP_POST_LANDSD_BASE_URL",
          "LAMP_POST_LANDSD_ENABLED",
          "LAMP_POST_API_URL",
        ],
        client: "landsd-lppun-un",
      },
      database: {
        enabled: () => process.env.LAMP_POST_DB_ENABLED === "true",
        table: "lamp_posts",
      },
    },
  },
  [PROVIDER_IDS.GOVERNMENT]: {
    providerId: PROVIDER_IDS.GOVERNMENT,
    labelZh: "政府地址",
    descriptionZh: "門牌、街道、建築物地址（OGCIO／地政總署）",
    acquisitionOrder: () => ["api"],
    modes: {
      api: {
        enabled: () => true,
        client: "hk-address-parser-lib",
      },
    },
  },
};

module.exports = {
  DATA_SOURCE_REGISTRY,
  parseAcquisitionOrder,
};
