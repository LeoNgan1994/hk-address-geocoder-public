function normalizeAddress(address) {
  return String(address || "").trim().replace(/\s+/g, " ");
}

function extractRoadTokens(raw) {
  const tokens = [];
  const zhRoad = raw.match(/([\u4e00-\u9fff]+路)/g);
  if (zhRoad) {
    tokens.push(...zhRoad);
  }
  const enRoad = raw.match(/\b([A-Za-z\s]+ROAD)\b/gi);
  if (enRoad) {
    tokens.push(...enRoad.map((item) => item.trim()));
  }
  return [...new Set(tokens)];
}

function normalize(raw) {
  const normalized = normalizeAddress(raw);
  return {
    raw,
    normalized,
    entities: {
      roadTokens: extractRoadTokens(normalized),
    },
  };
}

module.exports = {
  normalizeAddress,
  normalize,
};
