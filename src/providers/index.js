const governmentAddressProvider = require("./governmentAddressProvider");
const lampPostProvider = require("./lampPostProvider");
const { PROVIDER_IDS } = require("./providerIds");

const PROVIDERS = [lampPostProvider, governmentAddressProvider];

function getProviderById(providerId) {
  return PROVIDERS.find((provider) => provider.id === providerId);
}

module.exports = {
  PROVIDERS,
  PROVIDER_IDS,
  getProviderById,
  governmentAddressProvider,
  lampPostProvider,
};
