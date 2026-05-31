const { extractBuildingCues, normalizeBuildingCue } = require("../extractor/locationExtractor");

const NOISE_PATTERNS = [/Wi-Fi\.HK/i, /熱點位置/i, /Hotspot/i];

const BUILDING_SUFFIX_RE = /([\u4e00-\u9fff]{2,15}(?:中心|大廈|商場|廣場|塔|座))/g;
const BUILDING_CITY_RE = /([\u4e00-\u9fff]{2,10}城)/g;

function normalizeForMatch(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/，|,/g, "");
}

function addBuildingName(names, raw) {
  const name = normalizeBuildingCue(String(raw || "").trim());
  const minLen = /[園閣]$/.test(name) ? 2 : 3;
  if (
    name.length >= minLen &&
    !/^號/.test(name) &&
    !/[道街路里巷]$/.test(name)
  ) {
    names.add(name);
  }
}

function scanSegmentForBuildings(segment, names) {
  const cleaned = String(segment || "")
    .replace(/\d+樓.*$/, "")
    .replace(/\d+室.*$/, "")
    .trim();
  if (!cleaned) {
    return;
  }
  const segmentPatterns = [
    /[\u4e00-\u9fff]{1,6}新天地/g,
    /([\u4e00-\u9fff]{2,10}中心)/g,
    /([\u4e00-\u9fff]{2,12}(?:大廈|商場|廣場|塔|座|邨|苑|樓))/g,
    /([\u4e00-\u9fff]{2,8}閣)/g,
    /([\u4e00-\u9fff]{1,6}園)/g,
    BUILDING_CITY_RE,
  ];
  for (const re of segmentPatterns) {
    re.lastIndex = 0;
    let match = re.exec(cleaned);
    while (match) {
      addBuildingName(names, match[1] || match[0]);
      match = re.exec(cleaned);
    }
  }
}

/**
 * Extract building / mall names (e.g. 海洋中心, 海港城) from free text.
 */
function extractBuildingNames(text) {
  const input = String(text || "");
  const names = new Set();

  const afterDoorplate = input.match(/號\s*([^，,；;\n]+)/);
  if (afterDoorplate?.[1]) {
    scanSegmentForBuildings(afterDoorplate[1], names);
  }

  const suffixPatterns = [
    /[\u4e00-\u9fff]{1,6}新天地/g,
    /([\u4e00-\u9fff]{2,10}中心)/g,
    /([\u4e00-\u9fff]{2,12}(?:大廈|商場|廣場|塔|座|邨|苑|樓))/g,
    /([\u4e00-\u9fff]{2,8}閣)/g,
    /([\u4e00-\u9fff]{1,6}園)/g,
  ];
  for (const suffixOnly of suffixPatterns) {
    suffixOnly.lastIndex = 0;
    let match = suffixOnly.exec(input);
    while (match) {
      addBuildingName(names, match[1] || match[0]);
      match = suffixOnly.exec(input);
    }
  }

  const cityOnly = /([\u4e00-\u9fff]{2,8}城)/g;
  let cityMatch = cityOnly.exec(input);
  while (cityMatch) {
    addBuildingName(names, cityMatch[1]);
    cityMatch = cityOnly.exec(input);
  }

  if (afterDoorplate?.[1]) {
    const segment = afterDoorplate[1].replace(/\d+樓.*$/, "").trim();
    for (let i = 0; i < segment.length; i += 1) {
      const hit = segment.slice(i).match(/^([\u4e00-\u9fff]{2,8}中心)/);
      if (!hit?.[1]) {
        continue;
      }
      const token = hit[1];
      const aligned =
        i === 0 || (i > 0 && /[城廣場大廈商場座]/.test(segment[i - 1]));
      if (aligned) {
        addBuildingName(names, token);
      }
    }
  }

  for (const cue of extractBuildingCues(input)) {
    addBuildingName(names, cue);
  }

  return [...names]
    .filter((name) => input.includes(name))
    .sort((a, b) => b.length - a.length);
}

function recordLabel(record) {
  return `${record.matchedAddressZh || ""} ${record.nameZH || ""} ${record.nameEN || ""}`;
}

function recordMatchesBuildingToken(record, token) {
  const bn = normalizeForMatch(token);
  if (!bn) {
    return false;
  }
  const fields = [
    normalizeForMatch(record.nameZH),
    normalizeForMatch(record.matchedAddressZh),
    normalizeForMatch(record.nameEN),
  ];
  return fields.some((field) => field && field.includes(bn));
}

/**
 * Keep LandsD rows whose name/address contains at least one building token from input.
 */
function filterRecordsByBuildingKeywords(records, buildingNames) {
  if (!records?.length || !buildingNames?.length) {
    return [];
  }

  const tokens = [...buildingNames].sort((a, b) => b.length - a.length);
  return records.filter((record) => {
    if (NOISE_PATTERNS.some((re) => re.test(recordLabel(record)))) {
      return false;
    }
    return tokens.some((token) => recordMatchesBuildingToken(record, token));
  });
}

function rankFallbackQueries(street, buildingNames) {
  const scoreToken = (token) => {
    let score = 0;
    if (/中心|大廈|商場|廣場|塔|座/.test(token)) {
      score += 30;
      score -= Math.max(0, token.length - 5);
    }
    if (/城$/.test(token) && !/中心/.test(token)) {
      score -= 8;
    }
    return score;
  };

  const tokens = [...buildingNames].sort((a, b) => scoreToken(b) - scoreToken(a));
  const queries = [];

  for (const token of tokens) {
    if (street) {
      queries.push(`${street}${token}`);
    }
  }
  for (const token of tokens) {
    queries.push(token);
  }

  return [...new Set(queries)].filter((query) => query && query !== street);
}

function mergeRecordsByCoordinate(existing, incoming) {
  const byKey = new Map();
  for (const record of [...existing, ...incoming]) {
    const key = `${record.coordinateHk1980.x},${record.coordinateHk1980.y}`;
    if (!byKey.has(key)) {
      byKey.set(key, record);
    }
  }
  return [...byKey.values()];
}

/**
 * Street-first LandsD resolution plan:
 * 1) search street/doorplate
 * 2) filter pool by building keywords from original input
 * 3) optional fallback queries (street+building, building)
 */
function planStreetFirstSearch(geocodeQuery, originalInput) {
  const street = geocodeQuery ? geocodeQuery.trim() : "";
  const buildingNames = extractBuildingNames(originalInput);
  return {
    street,
    buildingNames,
    fallbackQueries: street ? rankFallbackQueries(street, buildingNames) : [],
    hasBuildingCue: buildingNames.length > 0,
  };
}

function applyStreetFirstPick(records, context, meta = {}) {
  const buildingNames =
    context.buildingNames || extractBuildingNames(context.originalInput);
  let pool = records;

  if (meta.strategy === "street_pool_match" || meta.strategy === "fallback_query_match") {
    pool = filterRecordsByBuildingKeywords(records, buildingNames);
    if (!pool.length) {
      pool = records;
    }
  }

  const pick = pickBestLandRecord(pool, {
    ...context,
    buildingNames,
  });

  return {
    ...pick,
    landsdStrategy: meta.strategy || null,
    landsdQueries: meta.queries || [],
    poolSize: records.length,
    matchedPoolSize: pool.length,
  };
}
function collectCenterTokens(text) {
  const tokens = new Set();
  const input = String(text || "");
  for (let i = 0; i < input.length; i += 1) {
    const rest = input.slice(i);
    const hit = rest.match(/^([\u4e00-\u9fff]{2,8}中心)/);
    if (hit) {
      tokens.add(hit[1]);
    }
  }
  return [...tokens];
}

/** @deprecated use extractBuildingNames */
function extractBuildingCue(text) {
  const names = extractBuildingNames(text);
  return names[0] || null;
}

function buildSearchQueries(geocodeQuery, originalInput) {
  const queries = new Set();
  const street = geocodeQuery ? geocodeQuery.trim() : "";
  if (street) {
    queries.add(street);
  }

  const buildings = extractBuildingNames(originalInput);
  const streetNorm = normalizeForMatch(street);

  for (const building of buildings) {
    const buildingNorm = normalizeForMatch(building);
    if (street && !streetNorm.includes(buildingNorm)) {
      queries.add(`${street}${building}`);
    }
    if (!streetNorm || streetNorm !== buildingNorm) {
      queries.add(building);
    }
  }

  for (const building of buildings) {
    for (const token of collectCenterTokens(building)) {
      if (street) {
        queries.add(`${street}${token}`);
      }
      queries.add(token);
    }
  }

  const afterSegment = originalInput.match(/號\s*([^，,；;\n]+)/)?.[1];
  if (afterSegment) {
    const segment = afterSegment.replace(/\d+樓.*$/, "").trim();
    for (const token of collectCenterTokens(segment)) {
      if (street) {
        queries.add(`${street}${token}`);
      }
      queries.add(token);
    }
  }

  const normalizedOriginal = String(originalInput || "").trim();
  if (
    normalizedOriginal &&
    normalizedOriginal !== street &&
    normalizedOriginal.length <= 120
  ) {
    queries.add(normalizedOriginal);
  }

  return [...queries];
}

function scoreRecord(record, context) {
  const { geocodeQuery, originalInput } = context;
  const buildingNames =
    context.buildingNames || extractBuildingNames(originalInput);
  const q = normalizeForMatch(geocodeQuery);
  const input = normalizeForMatch(originalInput);
  const addrZh = normalizeForMatch(record.matchedAddressZh);
  const nameZh = normalizeForMatch(
    record.nameZH || record.matchedAddressZh || ""
  );
  const label = `${record.matchedAddressZh || ""} ${record.nameZH || ""}`;

  let score = 0;

  if (NOISE_PATTERNS.some((re) => re.test(label))) {
    score -= 50;
  }

  if (q && (addrZh === q || addrZh.includes(q) || q.includes(addrZh))) {
    score += 30;
  }

  if (nameZh && input.includes(nameZh)) {
    score += 25;
  }

  for (const building of buildingNames) {
    const bn = normalizeForMatch(building);
    if (!bn) {
      continue;
    }
    if (nameZh.includes(bn) || addrZh.includes(bn)) {
      score += 45;
    }
    if (input.includes(bn)) {
      score += 12;
    }
    if (nameZh === bn) {
      score += 30;
    }
  }

  if (nameZh && /中心|大廈|商場|廣場|貿易/.test(nameZh)) {
    score += 8;
  }

  if (buildingNames.length > 0) {
    const matchesBuilding = buildingNames.some(
      (b) =>
        nameZh.includes(normalizeForMatch(b)) ||
        addrZh.includes(normalizeForMatch(b))
    );
    if (!matchesBuilding && /^\d+[,，]/.test(record.matchedAddressEn || "")) {
      score -= 25;
    }
  }

  if (/樓|舖|室|shop|podiu|wifi|醫療|化驗/i.test(label)) {
    score -= 15;
  }

  if (record.score != null && Number.isFinite(Number(record.score))) {
    score += Math.min(10, Number(record.score));
  }

  score -= (record._rankIndex ?? 0) * 0.2;

  return score;
}

function pickBestLandRecord(records, context) {
  if (!records?.length) {
    return null;
  }

  const enrichedContext = {
    ...context,
    buildingNames:
      context.buildingNames || extractBuildingNames(context.originalInput),
  };

  const scored = records.map((record, index) => ({
    record,
    score: scoreRecord({ ...record, _rankIndex: index }, enrichedContext),
  }));

  scored.sort((a, b) => b.score - a.score);
  return {
    best: scored[0].record,
    ranked: scored.slice(0, 5).map((item) => ({
      score: item.score,
      matchedAddressZh: item.record.matchedAddressZh,
      matchedAddressEn: item.record.matchedAddressEn,
      nameZH: item.record.nameZH || null,
      coordinate: item.record.coordinate,
    })),
  };
}

module.exports = {
  buildSearchQueries,
  pickBestLandRecord,
  applyStreetFirstPick,
  planStreetFirstSearch,
  filterRecordsByBuildingKeywords,
  rankFallbackQueries,
  mergeRecordsByCoordinate,
  scoreRecord,
  extractBuildingCue,
  extractBuildingNames,
  recordMatchesBuildingToken,
};
