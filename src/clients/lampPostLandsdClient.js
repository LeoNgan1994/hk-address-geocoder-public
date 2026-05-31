const { MAX_ATTEMPTS } = require("../requestMeta");
const { fetchExternal } = require("../net/outboundFetch");
const { hk1980ToWgs84 } = require("../utils/projConvert");

const RETRY_DELAY_MS = 400;
const DEFAULT_BASE_URL = "https://mapapi.geodata.gov.hk/gs/api/v1.0.0";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBaseUrl() {
  return (process.env.LAMP_POST_LANDSD_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}

function normalizeLampPostId(id) {
  return String(id || "")
    .trim()
    .toUpperCase()
    .replace(/^燈柱/, "");
}

function buildSearchUrl(lampPostId) {
  const base = getBaseUrl();
  const params = new URLSearchParams({
    text: normalizeLampPostId(lampPostId),
  });
  return `${base}/lus/un/SearchNumber?${params.toString()}`;
}

function pickBestCandidate(candidates, lampPostId) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  const normalized = normalizeLampPostId(lampPostId);
  const exact = candidates.find((item) => {
    const addr = String(item.address || item.attributes?.Match_addr || "");
    return addr.toUpperCase().includes(normalized);
  });
  return exact || candidates[0];
}

function parseCandidate(candidate, lampPostId) {
  const location = candidate.location || {};
  const x = Number(location.x);
  const y = Number(location.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  const coordinate = hk1980ToWgs84(x, y);
  const addressLabel = candidate.address || candidate.attributes?.Match_addr || `LPO - ${lampPostId}`;

  return {
    lamp_post_id: normalizeLampPostId(lampPostId),
    road_zh: addressLabel,
    road_en: addressLabel,
    district: null,
    lat: coordinate.lat,
    lng: coordinate.lng,
    hk_x: x,
    hk_y: y,
    score: candidate.score ?? candidate.attributes?.Score ?? null,
    notes: "Lands Department LPPUN SearchNumber (UN / Lamp Post)",
    acquisitionMode: "api",
    dataSource: "lands_department_un",
  };
}

async function fetchLampPostFromLandsd(lampPostId) {
  if (process.env.LAMP_POST_LANDSD_ENABLED === "false") {
    return { ok: false, reason: "LAMP_POST_LANDSD_ENABLED=false" };
  }

  const normalized = normalizeLampPostId(lampPostId);
  if (!normalized) {
    return { ok: false, reason: "invalid lamp post id" };
  }

  const url = buildSearchUrl(normalized);
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchExternal(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`LandsD UN API HTTP ${response.status}`);
      }

      const payload = await response.json();
      const candidate = pickBestCandidate(payload.candidates, normalized);
      const record = candidate ? parseCandidate(candidate, normalized) : null;

      if (!record) {
        return {
          ok: false,
          reason: "LandsD UN API returned no matching lamp post",
          attempt,
          url,
        };
      }

      return { ok: true, record, attempt, url };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  return {
    ok: false,
    reason: lastError?.message || "LandsD UN API request failed",
    attempts: MAX_ATTEMPTS,
    url,
  };
}

module.exports = {
  fetchLampPostFromLandsd,
  buildSearchUrl,
  normalizeLampPostId,
  DEFAULT_BASE_URL,
};
