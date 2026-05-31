/**
 * Extract geocodable queries, asset IDs, and remarks from free-form emergency text.
 */

const REMARK_KEYWORDS = [
  { pattern: /后巷|後巷/g, label: "後巷" },
  { pattern: /污水渠/g, label: "污水渠" },
  { pattern: /淤塞/g, label: "淤塞" },
  { pattern: /\bwest\s+of\b/gi, label: "West of" },
  { pattern: /\bmanhole\b/gi, label: "manhole" },
  { pattern: /地下/g, label: "地下" },
  { pattern: /平台/g, label: "平台" },
];

const ZH_STREET_RE =
  /([\u4e00-\u9fff]+[道街路里巷])\s*(\d+(?:-\d+)?[A-Za-z]?)\s*號?/g;
const ZH_VILLAGE_RE =
  /([\u4e00-\u9fff]{2,12})(\d+(?:-\d+)?[A-Za-z]?)\s*號/g;
const EN_STREET_RE =
  /(\d+(?:-\d+)?[A-Za-z]?)\s+([A-Za-z][A-Za-z\s]*?(?:STREET|ROAD|LANE|AVENUE|DRIVE))\b/gi;
/** Asset ID prefixes used to avoid lamp post false positives (e.g. FMH4017115). */
const MANHOLE_RE =
  /\b((?:FMH|SMH|STMH|RMH)\d+)\b|(?:manhole|沙井)\s*[:：]?\s*((?:FMH|SMH|STMH|RMH)\d+)/i;
const MANHOLE_PREFIX_RE = /^(?:FMH|SMH|STMH|RMH)/i;
const LAMP_POST_EXPLICIT_RE = /燈柱\s*([A-Z0-9]{2,12})/i;
const LAMP_POST_ID_RE = /\b([A-Z]{1,4}\d{2,7}|\d[A-Z]{1,3}\d{2,5})\b/g;
const LANE_ID_RE = /\bLane\s*(\d+)\b/i;

const BUILDING_PATTERNS = [
  /[\u4e00-\u9fff]{1,4}新天地/g,
  /[\u4e00-\u9fff]{2,10}(?:中心|大廈|商場|廣場|邨|苑|樓|座|城)/g,
  /[\u4e00-\u9fff]{2,8}閣/g,
  /[\u4e00-\u9fff]{1,6}園/g,
];

function normalizeBuildingCue(name) {
  return String(name || "")
    .replace(/^號+/g, "")
    .replace(/\d+樓.*$/g, "")
    .replace(/\d+期.*$/g, "")
    .trim();
}

function isValidBuildingCue(name) {
  const cue = normalizeBuildingCue(name);
  return (
    cue.length >= 2 &&
    !/^號/.test(cue) &&
    !/^\d/.test(cue) &&
    !/[道街路里巷]$/.test(cue)
  );
}

function addBuildingCue(names, raw) {
  const cue = normalizeBuildingCue(raw);
  if (isValidBuildingCue(cue)) {
    names.add(cue);
  }
}

function scanTextForBuildingCues(text, names) {
  const input = String(text || "");
  for (const pattern of BUILDING_PATTERNS) {
    pattern.lastIndex = 0;
    let match = pattern.exec(input);
    while (match) {
      addBuildingCue(names, match[0]);
      match = pattern.exec(input);
    }
  }
}

function sanitize(text) {
  return String(text || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanGeocodeQuery(query) {
  return String(query || "")
    .replace(/后巷|後巷/g, "")
    .replace(/污水渠[\s\S]*/g, "")
    .replace(/\bwest\s+of\b/gi, "")
    .replace(/\bmanhole\b/gi, "")
    .replace(/^(?:投訴|查詢|稟報|報案)+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function withDoorplateSuffix(street, number) {
  const num = String(number || "").replace(/號$/g, "");
  return `${street}${num}號`;
}

function formatZhStreetQuery(street, number) {
  return cleanGeocodeQuery(withDoorplateSuffix(street, number));
}

function isVillagePlaceName(name) {
  if (!name || /[道街路里巷]$/.test(name)) {
    return false;
  }
  if (/[與及交界]/.test(name)) {
    return false;
  }
  if (/排檔|綠色|菜市|街市|大廈|商場/.test(name)) {
    return false;
  }
  if (name.length > 8) {
    return false;
  }
  return /[村圍坑台仔嶺洲鄉]$/.test(name) || name.length <= 5;
}

const JUNCTION_STREET_RE =
  /([\u4e00-\u9fff]+[道街路里巷])(?:與|及)([\u4e00-\u9fff]+[道街路里巷])[^0-9]{0,40}?(\d+(?:-\d+)?[A-Za-z]?)\s*號/g;

function extractJunctionCandidates(text) {
  const candidates = [];
  let match = JUNCTION_STREET_RE.exec(text);
  while (match) {
    const streetA = match[1];
    const streetB = match[2];
    const number = match[3];
    const streets = [streetB, streetA];
    for (let i = 0; i < streets.length; i += 1) {
      const query = formatZhStreetQuery(streets[i], number);
      if (query) {
        candidates.push({
          query,
          score: scoreCandidate(query, text, match.index) + 10 - i,
          source: "zh-junction",
        });
      }
    }
    match = JUNCTION_STREET_RE.exec(text);
  }
  JUNCTION_STREET_RE.lastIndex = 0;
  return candidates;
}

function extractManholeId(text) {
  const match = text.match(MANHOLE_RE);
  if (!match) {
    return null;
  }
  return (match[1] || match[2] || "").toUpperCase() || null;
}

function extractLampPostId(text) {
  const explicit = text.match(LAMP_POST_EXPLICIT_RE);
  if (explicit?.[1]) {
    return explicit[1].toUpperCase();
  }

  const manholeId = extractManholeId(text);
  let match = LAMP_POST_ID_RE.exec(text);
  while (match) {
    const candidate = match[1].toUpperCase();
    if (!MANHOLE_PREFIX_RE.test(candidate) && candidate !== manholeId) {
      LAMP_POST_ID_RE.lastIndex = 0;
      return candidate;
    }
    match = LAMP_POST_ID_RE.exec(text);
  }
  LAMP_POST_ID_RE.lastIndex = 0;
  return null;
}

function extractLaneId(text) {
  const match = text.match(LANE_ID_RE);
  return match ? match[1] : null;
}

function extractRemarks(text) {
  const remarks = [];
  for (const { pattern, label } of REMARK_KEYWORDS) {
    if (pattern.test(text)) {
      remarks.push(label);
    }
    pattern.lastIndex = 0;
  }
  return [...new Set(remarks)];
}

/** @deprecated use cleanGeocodeQuery */
function stripRemarksFromQuery(query) {
  return cleanGeocodeQuery(query);
}

function extractBuildingCues(text) {
  const input = String(text || "");
  const names = new Set();

  const afterDoorplate = input.match(/號\s*([^，,；;\n]+)/);
  if (afterDoorplate?.[1]) {
    const segment = afterDoorplate[1].replace(/\d+樓.*$/, "").trim();
    scanTextForBuildingCues(segment, names);
  }

  scanTextForBuildingCues(input, names);

  return [...names].sort((a, b) => b.length - a.length);
}

function scoreCandidate(query, fullText, index, extra = {}) {
  let score = 0;
  if (/[\u4e00-\u9fff]+[道街路里巷]\d/.test(query)) {
    score += 12;
  }
  if (/\d+號/.test(query) || /\d+[A-Za-z]號/.test(query)) {
    score += 8;
  }
  if (extra.building) {
    score += 18;
  }
  if (/^(?:投訴|查詢)/.test(query)) {
    score -= 40;
  }
  const window = fullText.slice(Math.max(0, index - 5), index + 80);
  if (/后巷|後巷/.test(window)) {
    score += 10;
  }
  if (/淤塞|污水渠|渠塞/.test(window)) {
    score += 4;
  }
  if (query.length <= 16) {
    score += 3;
  }
  if (query.length > 40) {
    score -= 8;
  }
  if (/[A-Za-z]{3,}/.test(query) && /[\u4e00-\u9fff]/.test(query)) {
    score -= 4;
  }
  return score;
}

function extractZhCandidates(text) {
  const candidates = [];
  const buildings = extractBuildingCues(text);

  let match = ZH_STREET_RE.exec(text);
  while (match) {
    const street = match[1];
    const number = match[2];
    const query = formatZhStreetQuery(street, number);
    if (query) {
      candidates.push({
        query,
        score: scoreCandidate(query, text, match.index),
        source: "zh",
      });
      for (const building of buildings) {
        const combined = cleanGeocodeQuery(
          `${withDoorplateSuffix(street, number)}${normalizeBuildingCue(building)}`
        );
        if (combined && combined !== query) {
          candidates.push({
            query: combined,
            score: scoreCandidate(combined, text, match.index, { building: true }),
            source: "zh-building",
          });
        }
      }
    }
    match = ZH_STREET_RE.exec(text);
  }
  ZH_STREET_RE.lastIndex = 0;

  match = ZH_VILLAGE_RE.exec(text);
  while (match) {
    const place = match[1];
    const number = match[2];
    if (isVillagePlaceName(place)) {
      const query = formatZhStreetQuery(place, number);
      if (query) {
        candidates.push({
          query,
          score: scoreCandidate(query, text, match.index) + 2,
          source: "zh-village",
        });
      }
    }
    match = ZH_VILLAGE_RE.exec(text);
  }
  ZH_VILLAGE_RE.lastIndex = 0;

  return candidates;
}

function extractEnCandidates(text) {
  const candidates = [];
  let match = EN_STREET_RE.exec(text);
  while (match) {
    const before = text.slice(Math.max(0, match.index - 12), match.index);
    if (/\blane\s*$/i.test(before)) {
      match = EN_STREET_RE.exec(text);
      continue;
    }
    const number = match[1];
    const street = match[2].trim().replace(/\s+/g, " ");
    const query = cleanGeocodeQuery(`${number} ${street}`);
    if (query) {
      candidates.push({
        query,
        score: scoreCandidate(query, text, match.index) - 3,
        source: "en",
      });
    }
    match = EN_STREET_RE.exec(text);
  }
  EN_STREET_RE.lastIndex = 0;
  return candidates;
}

function dedupeAndRank(candidates) {
  const byKey = new Map();
  for (const item of candidates) {
    const cleaned = cleanGeocodeQuery(item.query);
    if (!cleaned) {
      continue;
    }
    const key = cleaned.toLowerCase().replace(/\s+/g, "");
    const normalized = { ...item, query: cleaned };
    const existing = byKey.get(key);
    if (!existing || normalized.score > existing.score) {
      byKey.set(key, normalized);
    }
  }
  return [...byKey.values()].sort((a, b) => b.score - a.score);
}

function preferZhOverEn(queries) {
  const zhQueries = queries.filter((q) => /[\u4e00-\u9fff]/.test(q.query));
  if (zhQueries.length > 0) {
    const enOnly = queries.filter((q) => !/[\u4e00-\u9fff]/.test(q.query));
    return [...zhQueries, ...enOnly];
  }
  return queries;
}

/**
 * @param {string} rawText
 * @returns {{
 *   sanitized: string,
 *   manholeId: string|null,
 *   laneId: string|null,
 *   remarks: string[],
 *   buildingCues: string[],
 *   geocodeQueries: string[],
 *   primaryGeocodeQuery: string|null,
 *   candidates: Array<{ query: string, score: number, source: string }>,
 * }}
 */
function extractFromText(rawText) {
  const sanitized = sanitize(rawText);
  const manholeId = extractManholeId(sanitized);
  const laneId = extractLaneId(sanitized);
  const remarks = extractRemarks(sanitized);
  const buildingCues = extractBuildingCues(sanitized);

  let candidates = dedupeAndRank([
    ...extractZhCandidates(sanitized),
    ...extractJunctionCandidates(sanitized),
    ...extractEnCandidates(sanitized),
  ]);
  candidates = preferZhOverEn(candidates);

  const geocodeQueries = candidates.map((c) => c.query).filter(Boolean);
  const primaryGeocodeQuery = geocodeQueries[0] || null;

  const lampPostId = extractLampPostId(sanitized);

  return {
    sanitized,
    manholeId,
    lampPostId,
    laneId,
    remarks,
    buildingCues,
    geocodeQueries,
    primaryGeocodeQuery,
    candidates,
  };
}

module.exports = {
  sanitize,
  extractFromText,
  extractManholeId,
  extractLampPostId,
  extractRemarks,
  extractBuildingCues,
  normalizeBuildingCue,
  cleanGeocodeQuery,
  stripRemarksFromQuery,
};
