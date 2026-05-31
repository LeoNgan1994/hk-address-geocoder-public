const { fetchLampPostFromLandsd } = require("./lampPostLandsdClient");
const { fetchExternal } = require("../net/outboundFetch");
const { MAX_ATTEMPTS } = require("../requestMeta");

const RETRY_DELAY_MS = 400;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildCustomRequestUrl(lampPostId) {
  const template = process.env.LAMP_POST_API_URL;
  const encodedId = encodeURIComponent(lampPostId);
  if (template.includes("{lampPostId}")) {
    return template.replace("{lampPostId}", encodedId);
  }
  if (template.includes("{id}")) {
    return template.replace("{id}", encodedId);
  }
  const separator = template.includes("?") ? "&" : "?";
  return `${template}${separator}id=${encodedId}`;
}

function pickCoordinate(payload) {
  const lat = Number(
    payload.lat ?? payload.latitude ?? payload.Latitude ?? payload.y ?? payload.coord?.lat
  );
  const lng = Number(
    payload.lng ?? payload.longitude ?? payload.Longitude ?? payload.x ?? payload.coord?.lng
  );
  return { lat, lng };
}

function normalizeCustomApiRecord(payload, lampPostId) {
  const root = payload.data || payload.result || payload.record || payload;
  const row = Array.isArray(root) ? root[0] : root;
  if (!row || typeof row !== "object") {
    return null;
  }

  const coordinate = pickCoordinate(row);
  if (!Number.isFinite(coordinate.lat) || !Number.isFinite(coordinate.lng)) {
    return null;
  }

  return {
    lamp_post_id: String(row.lampPostId || row.lamp_post_id || row.id || lampPostId).toUpperCase(),
    road_zh: row.roadZh || row.road_zh || row.roadNameZh || null,
    road_en: row.roadEn || row.road_en || row.roadNameEn || null,
    district: row.district || row.districtZh || null,
    lat: coordinate.lat,
    lng: coordinate.lng,
    notes: row.notes || "from custom lamp post API",
    acquisitionMode: "api",
  };
}

async function fetchFromCustomApi(lampPostId) {
  if (!process.env.LAMP_POST_API_URL) {
    return { ok: false, reason: "LAMP_POST_API_URL not configured" };
  }

  const url = buildCustomRequestUrl(lampPostId);
  const headers = { Accept: "application/json" };
  if (process.env.LAMP_POST_API_KEY) {
    headers.Authorization = `Bearer ${process.env.LAMP_POST_API_KEY}`;
  }

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchExternal(url, { method: "GET", headers });
      if (!response.ok) {
        throw new Error(`Lamp post API HTTP ${response.status}`);
      }
      const payload = await response.json();
      const record = normalizeCustomApiRecord(payload, lampPostId);
      if (!record) {
        return { ok: false, reason: "API response missing coordinates", attempt };
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
    reason: lastError?.message || "Lamp post API request failed",
    attempts: MAX_ATTEMPTS,
    url,
  };
}

/**
 * Default: LandsD public UN API. Optional override via LAMP_POST_API_URL.
 */
async function fetchLampPostById(lampPostId) {
  if (process.env.LAMP_POST_API_URL) {
    const custom = await fetchFromCustomApi(lampPostId);
    if (custom.ok) {
      return custom;
    }
  }

  return fetchLampPostFromLandsd(lampPostId);
}

module.exports = {
  fetchLampPostById,
  fetchLampPostFromLandsd,
  fetchFromCustomApi,
};
