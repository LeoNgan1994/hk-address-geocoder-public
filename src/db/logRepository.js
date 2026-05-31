const { isLogToDbEnabled, query } = require("./client");

function hkLogDate(isoTs = new Date().toISOString()) {
  return isoTs.slice(0, 10);
}

async function insertLog(record) {
  if (!isLogToDbEnabled()) {
    return null;
  }

  const ts = record.ts || new Date().toISOString();
  const result = await query(
    `INSERT INTO geocode_logs (
       ts, log_date, level, event, session_id, address, provider_id, payload,
       client_ip, user_agent, api_key_id, api_key_name,
       http_method, http_path, status_code, duration_ms, request_id, auth_mode
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     RETURNING id`,
    [
      ts,
      hkLogDate(ts),
      record.level,
      record.event,
      record.sessionId,
      record.address || null,
      record.providerId || record.provider_id || null,
      JSON.stringify(record.payload || {}),
      record.clientIp || null,
      record.userAgent || null,
      record.apiKeyId || null,
      record.apiKeyName || null,
      record.httpMethod || null,
      record.httpPath || null,
      record.statusCode ?? null,
      record.durationMs ?? null,
      record.requestId || record.sessionId || null,
      record.authMode || null,
    ]
  );
  return result.rows[0]?.id ?? null;
}

module.exports = {
  insertLog,
  hkLogDate,
};
