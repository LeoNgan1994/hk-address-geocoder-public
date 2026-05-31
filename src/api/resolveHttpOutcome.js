const {
  toPublicProviderId,
  mapPublicProviderList,
} = require("./publicProviderNames");

/**
 * Maps geocode engine result → HTTP status + unified error for v1 resolve.
 */
function describeUpstreamFailure(fullResult) {
  const routing = fullResult.routing || {};
  const providerId = routing.selectedProvider || fullResult.providerId || null;
  const triedProviders = routing.triedProviders || [];
  const errorMessage = fullResult.request?.errorMessage || "上游資料源查詢失敗";

  let messageZh = errorMessage;
  if (providerId === "lamp_post_registry") {
    messageZh = `燈柱上游（LandsD）失敗：${errorMessage}`;
  } else if (providerId === "government_address") {
    messageZh = `政府地址上游（OGCIO／地政總署）失敗：${errorMessage}`;
  }

  return {
    status: 502,
    error: "upstream_failed",
    message: messageZh,
    source: "upstream",
    details: {
      failedAt: "upstream",
      providerId: toPublicProviderId(providerId),
      triedProviders: mapPublicProviderList(triedProviders),
      acquisitionMode: routing.acquisitionMode || fullResult.dataAcquisition || null,
      errorMessage,
      manhole: fullResult.manholeLookup?.requested
        ? {
            id: fullResult.manholeLookup.manholeId,
            found: fullResult.manholeLookup.found,
            reason: fullResult.manholeLookup.reason,
          }
        : undefined,
    },
  };
}

function describeNoCoordinate(fullResult, payload) {
  const routing = fullResult.routing || {};
  const triedProviders = routing.triedProviders || [];
  const providerId = routing.selectedProvider || fullResult.providerId || null;

  const parts = [];
  if (fullResult.manholeLookup?.requested && !fullResult.manholeLookup.found) {
    parts.push(`沙井 ${fullResult.manholeLookup.manholeId} 未命中`);
  }
  if (triedProviders.length > 0) {
    parts.push(`已嘗試：${triedProviders.join(" → ")}`);
  }
  const message =
    parts.length > 0
      ? `未能解析出有效座標（${parts.join("；")}）`
      : "未能解析出有效座標";

  return {
    status: 422,
    error: "no_coordinate",
    message,
    source: "resolver",
    details: {
      failedAt: "resolver",
      engineStatus: fullResult.status,
      providerId: toPublicProviderId(providerId),
      triedProviders: mapPublicProviderList(triedProviders),
      classifier: routing.classifier || null,
      hints: routing.hints || [],
      geocodeQuery: fullResult.geocodeQuery || null,
      manhole: payload.manhole || undefined,
      remarks: payload.remarks || [],
    },
  };
}

function buildResolveHttpOutcome(fullResult, payload) {
  if (fullResult.request?.requestFailed) {
    return describeUpstreamFailure(fullResult);
  }

  const coordinate = payload.coordinate;
  const hasCoordinate =
    fullResult.status === "success" &&
    coordinate &&
    Number(coordinate.lat) !== 0 &&
    Number(coordinate.lng) !== 0;

  if (!hasCoordinate) {
    return describeNoCoordinate(fullResult, payload);
  }

  return { status: 200, body: payload };
}

function buildInternalGeocodeHttpOutcome(fullResult) {
  if (fullResult.request?.requestFailed) {
    const upstream = describeUpstreamFailure(fullResult);
    return {
      status: upstream.status,
      body: {
        ...fullResult,
        apiError: {
          error: upstream.error,
          message: upstream.message,
          source: upstream.source,
          details: upstream.details,
        },
      },
    };
  }

  const coordinate = fullResult.coordinate || {};
  const hasCoordinate =
    fullResult.status === "success" &&
    Number(coordinate.lat) !== 0 &&
    Number(coordinate.lng) !== 0;

  if (!hasCoordinate) {
    const noCoord = describeNoCoordinate(fullResult, {
      manhole: fullResult.manholeLookup,
      remarks: fullResult.remarks || [],
    });
    return {
      status: noCoord.status,
      body: {
        ...fullResult,
        apiError: {
          error: noCoord.error,
          message: noCoord.message,
          source: noCoord.source,
          details: noCoord.details,
        },
      },
    };
  }

  return { status: 200, body: fullResult };
}

module.exports = {
  buildResolveHttpOutcome,
  buildInternalGeocodeHttpOutcome,
  describeUpstreamFailure,
  describeNoCoordinate,
};
