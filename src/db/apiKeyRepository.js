const { isDatabaseAvailable, query } = require("./client");

const KEY_COLUMNS = `id, key_prefix, name, description, enabled, created_at, last_used_at, expires_at, created_by,
  daily_quota, rate_limit_per_minute`;

async function findByHash(keyHash) {
  if (!isDatabaseAvailable()) {
    return null;
  }
  const result = await query(
    `SELECT ${KEY_COLUMNS}
     FROM api_keys
     WHERE key_hash = $1
     LIMIT 1`,
    [keyHash]
  );
  return result.rows[0] || null;
}

async function findById(id) {
  if (!isDatabaseAvailable()) {
    return null;
  }
  const result = await query(
    `SELECT ${KEY_COLUMNS}
     FROM api_keys WHERE id = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

async function listKeys() {
  if (!isDatabaseAvailable()) {
    return [];
  }
  const result = await query(
    `SELECT ${KEY_COLUMNS}
     FROM api_keys
     ORDER BY created_at DESC`
  );
  return result.rows;
}

async function insertKey(row) {
  const result = await query(
    `INSERT INTO api_keys (
       key_prefix, key_hash, name, description, is_admin, enabled, expires_at, created_by,
       daily_quota, rate_limit_per_minute
     )
     VALUES ($1, $2, $3, $4, FALSE, $5, $6, $7, $8, $9)
     RETURNING ${KEY_COLUMNS}`,
    [
      row.keyPrefix,
      row.keyHash,
      row.name,
      row.description || null,
      row.enabled !== false,
      row.expiresAt || null,
      row.createdBy || null,
      row.dailyQuota ?? null,
      row.rateLimitPerMinute ?? null,
    ]
  );
  return result.rows[0];
}

async function updateKey(id, fields) {
  const sets = [];
  const values = [id];
  let idx = 2;

  if (typeof fields.enabled === "boolean") {
    sets.push(`enabled = $${idx++}`);
    values.push(fields.enabled);
  }
  if (fields.dailyQuota !== undefined) {
    sets.push(`daily_quota = $${idx++}`);
    values.push(fields.dailyQuota);
  }
  if (fields.rateLimitPerMinute !== undefined) {
    sets.push(`rate_limit_per_minute = $${idx++}`);
    values.push(fields.rateLimitPerMinute);
  }

  if (sets.length === 0) {
    return findById(id);
  }

  const result = await query(
    `UPDATE api_keys SET ${sets.join(", ")} WHERE id = $1 RETURNING ${KEY_COLUMNS}`,
    values
  );
  return result.rows[0] || null;
}

async function setEnabled(id, enabled) {
  return updateKey(id, { enabled });
}

async function deleteKey(id) {
  const result = await query(`DELETE FROM api_keys WHERE id = $1 RETURNING id`, [id]);
  return result.rows[0] || null;
}

async function touchLastUsed(id) {
  if (!isDatabaseAvailable()) {
    return;
  }
  await query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [id]);
}

module.exports = {
  findByHash,
  findById,
  listKeys,
  insertKey,
  updateKey,
  setEnabled,
  deleteKey,
  touchLastUsed,
};
