const { toPublicProviderId } = require("./publicProviderNames");

/**
 * Public API shape for internal staff clients.
 */
function buildManholePayload(manholeLookup) {
  if (!manholeLookup?.requested) {
    return null;
  }

  if (manholeLookup.found) {
    return {
      id: manholeLookup.manholeId,
      found: true,
      networkType: manholeLookup.networkType || null,
      featNum: manholeLookup.featNum || manholeLookup.manholeId,
    };
  }

  return {
    id: manholeLookup.manholeId,
    found: false,
    message: manholeLookup.messageZh || manholeLookup.reason || "找不到沙井",
    reason: manholeLookup.reason || null,
    triedLayers: manholeLookup.triedLayers || [],
  };
}

function buildCoordinatesPayload(fullResult) {
  const wgs = fullResult.coordinate || { lat: 0, lng: 0 };
  const hasWgs =
    fullResult.status === "success" &&
    Number(wgs.lat) !== 0 &&
    Number(wgs.lng) !== 0;
  if (!hasWgs) {
    return null;
  }

  const hk = fullResult.coordinateHk1980;
  const hasHk =
    hk &&
    Number.isFinite(Number(hk.x)) &&
    Number.isFinite(Number(hk.y)) &&
    Number(hk.x) !== 0 &&
    Number(hk.y) !== 0;

  return {
    wgs84: {
      crs: "EPSG:4326",
      lat: Number(wgs.lat),
      lng: Number(wgs.lng),
    },
    hk1980: hasHk
      ? {
          crs: hk.crs || "EPSG:2326",
          x: Number(hk.x),
          y: Number(hk.y),
        }
      : null,
  };
}

function formatResolveResponse(fullResult, input, options = {}) {
  const { includeDetail = false } = options;
  const coordinate = fullResult.coordinate || { lat: 0, lng: 0 };
  const hasCoordinate =
    fullResult.status === "success" &&
    Number(coordinate.lat) !== 0 &&
    Number(coordinate.lng) !== 0;
  const coordinates = buildCoordinatesPayload(fullResult);

  const payload = {
    input,
    status: fullResult.status,
    coordinate: hasCoordinate ? { lat: coordinate.lat, lng: coordinate.lng } : null,
    coordinates,
    provider: toPublicProviderId(fullResult.providerId),
    geocodeQuery: fullResult.geocodeQuery || null,
    remarks: fullResult.remarks || [],
    manhole: buildManholePayload(fullResult.manholeLookup),
    matchedAddressZh: fullResult.matchedAddressZh || "",
    matchedAddressEn: fullResult.matchedAddressEn || "",
    requestFailed: Boolean(fullResult.request?.requestFailed),
  };

  if (fullResult.landsdCandidates?.length) {
    payload.landsdCandidateCount = fullResult.landsdCandidates.length;
  }

  if (includeDetail) {
    payload.detail = fullResult;
    if (fullResult.landsdCandidates) {
      payload.landsdCandidates = fullResult.landsdCandidates;
    }
    if (fullResult.landsdQueries) {
      payload.landsdQueries = fullResult.landsdQueries;
    }
  }

  return payload;
}

module.exports = {
  formatResolveResponse,
  buildManholePayload,
};
