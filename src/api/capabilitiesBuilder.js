const { DATA_SOURCE_REGISTRY } = require("../config/dataSources");
const { listProviderCapabilities } = require("../middleware/dataSourceMiddleware");
const { toPublicProviderId } = require("./publicProviderNames");

const MODULE_COPY = {
  government_address: {
    description: "門牌、街道、建築物地址（OGCIO／地政總署）",
  },
  lamp_post_registry: {
    description: "燈柱編號，如 GD3840（LandsD UN SearchNumber 或本地表）",
  },
};

function buildModulesFromRegistry() {
  return Object.values(DATA_SOURCE_REGISTRY).map((entry) => ({
    id: toPublicProviderId(entry.providerId),
    labelZh: entry.labelZh,
    description: entry.descriptionZh || MODULE_COPY[entry.providerId]?.description || "",
    acquisitionOrder: entry.acquisitionOrder(),
    modes: Object.fromEntries(
      Object.entries(entry.modes).map(([mode, cfg]) => [mode, cfg.enabled()])
    ),
  }));
}

function buildCapabilitiesPayload() {
  return {
    modules: buildModulesFromRegistry(),
    dataSources: listProviderCapabilities(),
  };
}

module.exports = {
  buildCapabilitiesPayload,
  buildModulesFromRegistry,
};
