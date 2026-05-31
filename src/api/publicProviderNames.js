/**
 * Internal routing IDs → public API provider labels for clients.
 */
const INTERNAL_TO_PUBLIC = {
  government_address: "landsD",
  lamp_post_registry: "landsD",
};

function toPublicProviderId(internalId) {
  if (!internalId) {
    return null;
  }
  return INTERNAL_TO_PUBLIC[internalId] || internalId;
}

function mapPublicProviderList(internalIds) {
  if (!Array.isArray(internalIds)) {
    return [];
  }
  return internalIds.map((id) => toPublicProviderId(id));
}

module.exports = {
  toPublicProviderId,
  mapPublicProviderList,
};
