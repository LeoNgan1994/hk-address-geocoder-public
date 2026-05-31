const fs = require("fs");
const path = require("path");
const { isDbEnabled, query } = require("./client");

const SEED_PATH = path.join(__dirname, "..", "..", "data", "lamp-posts.seed.json");

let seedCache = null;

function normalizeLampPostId(id) {
  return String(id || "")
    .trim()
    .toUpperCase()
    .replace(/^燈柱/, "");
}

function loadSeedRows() {
  if (seedCache) {
    return seedCache;
  }
  if (!fs.existsSync(SEED_PATH)) {
    seedCache = [];
    return seedCache;
  }
  seedCache = JSON.parse(fs.readFileSync(SEED_PATH, "utf8")).map((row) => ({
    lamp_post_id: normalizeLampPostId(row.lampPostId),
    road_zh: row.roadZh,
    road_en: row.roadEn,
    district: row.district,
    lat: row.lat,
    lng: row.lng,
    notes: row.notes,
  }));
  return seedCache;
}

function findInSeed(lampPostId) {
  const normalized = normalizeLampPostId(lampPostId);
  return loadSeedRows().find((row) => row.lamp_post_id === normalized) || null;
}

async function findByLampPostId(lampPostId) {
  const normalized = normalizeLampPostId(lampPostId);

  if (isDbEnabled()) {
    const result = await query(
      `SELECT lamp_post_id, road_zh, road_en, district, lat, lng, notes
       FROM lamp_posts WHERE UPPER(lamp_post_id) = $1 LIMIT 1`,
      [normalized]
    );
    if (result.rows[0]) {
      return result.rows[0];
    }
  }

  return findInSeed(normalized);
}

async function upsertLampPost(row) {
  if (!isDbEnabled()) {
    return null;
  }
  const lampPostId = normalizeLampPostId(row.lampPostId);
  const result = await query(
    `INSERT INTO lamp_posts (lamp_post_id, road_zh, road_en, district, lat, lng, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (lamp_post_id) DO UPDATE SET
       road_zh = EXCLUDED.road_zh,
       road_en = EXCLUDED.road_en,
       district = EXCLUDED.district,
       lat = EXCLUDED.lat,
       lng = EXCLUDED.lng,
       notes = EXCLUDED.notes,
       updated_at = NOW()
     RETURNING lamp_post_id`,
    [
      lampPostId,
      row.roadZh || null,
      row.roadEn || null,
      row.district || null,
      row.lat,
      row.lng,
      row.notes || null,
    ]
  );
  return result.rows[0];
}

async function count() {
  if (isDbEnabled()) {
    const result = await query(`SELECT COUNT(*)::int AS count FROM lamp_posts`);
    return result.rows[0]?.count || 0;
  }
  return loadSeedRows().length;
}

module.exports = {
  normalizeLampPostId,
  findByLampPostId,
  upsertLampPost,
  count,
};
