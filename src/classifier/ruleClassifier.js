const { normalizeAddress } = require("../normalizer/addressNormalizer");

const { extractManholeId, extractLampPostId } = require("../extractor/locationExtractor");

const HINT = {
  MANHOLE: "manhole",
  LAMP_POST: "lamp_post",
  ROAD: "road",
  BUILDING: "building",
  MIXED: "mixed",
  UNKNOWN: "unknown",
};


function hasBuildingCue(text) {
  return /(廣場|中心|大廈|商場|邨|苑|樓|座|shop|building|centre|center|mall|tower)/i.test(text);
}

function hasStreetNumber(text) {
  return /\d+\s*號/.test(text) || /\bno\.?\s*\d+/i.test(text);
}

/**
 * Rule-based classifier (Phase 1 primary path).
 */
function classify(rawInput, options = {}) {
  const normalized = normalizeAddress(options.geocodeQuery || rawInput);
  const manholeId = options.ignoreManhole
    ? null
    : options.manholeId || extractManholeId(rawInput);
  const lampPostId = options.ignoreLampPost
    ? null
    : options.lampPostId || extractLampPostId(rawInput);
  const hints = [];

  if (manholeId) {
    hints.push(HINT.MANHOLE);
  }
  if (lampPostId) {
    hints.push(HINT.LAMP_POST);
  }
  if (/路|road/i.test(normalized)) {
    hints.push(HINT.ROAD);
  }
  if (hasBuildingCue(normalized)) {
    hints.push(HINT.BUILDING);
  }
  if (hasStreetNumber(normalized)) {
    hints.push(HINT.BUILDING);
  }
  if (hints.length === 0) {
    hints.push(HINT.UNKNOWN);
  }

  let confidence = 0.5;
  if (manholeId) {
    confidence = 0.95;
  } else if (lampPostId) {
    confidence = 0.92;
  } else if (hasBuildingCue(normalized) && hasStreetNumber(normalized)) {
    confidence = 0.85;
  } else if (hasBuildingCue(normalized)) {
    confidence = 0.75;
  } else if (/路|road/i.test(normalized)) {
    confidence = 0.55;
  }

  return {
    raw: rawInput,
    normalized,
    entities: {
      manholeId,
      lampPostId,
      roadTokens: normalized.match(/([\u4e00-\u9fff]+路)|([A-Za-z\s]+ROAD)/gi) || [],
    },
    hints: [...new Set(hints)],
    confidence,
    classifier: "rule",
    routing: {
      primaryProvider: lampPostId ? "lamp_post_registry" : "government_address",
      fallbackProviders: lampPostId ? [] : [],
    },
  };
}

module.exports = {
  HINT,
  classify,
  extractLampPostId,
};
