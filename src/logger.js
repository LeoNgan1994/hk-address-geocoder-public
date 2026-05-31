const fs = require("fs");
const path = require("path");
const logRepository = require("./db/logRepository");
const { mergeRequestContext } = require("./api/requestContext");
const { isLogToDbEnabled } = require("./db/client");
const { sanitizeAddressForLog } = require("./lib/logSanitize");

const LOG_DIR = path.join(__dirname, "..", "logs");

function todayLogBasename() {
  const hkDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
  return `geocode-${hkDate}.log`;
}

/** Optional file fallback when explicitly enabled */
function logToFileEnabled() {
  return process.env.LOG_TO_FILE === "true";
}

function ensureLogDir() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function formatConsoleLine(level, event, payload) {
  const time = new Date().toISOString();
  const detail = payload.address || payload.message || payload.error || "";
  return `[${time}] [${level.toUpperCase()}] ${event}${detail ? ` — ${detail}` : ""}`;
}

function buildDbRecord({ ts, level, event, sessionId, payload, requestContext }) {
  const dbPayload = { ...payload };
  const address = sanitizeAddressForLog(dbPayload.address);
  const providerId = dbPayload.providerId || dbPayload.provider_id;
  delete dbPayload.address;
  delete dbPayload.providerId;
  delete dbPayload.provider_id;

  const ctx = requestContext || {};
  const statusCode = dbPayload.statusCode;
  const durationMs = dbPayload.durationMs;
  delete dbPayload.statusCode;
  delete dbPayload.durationMs;

  return {
    ts,
    level,
    event,
    sessionId,
    address,
    providerId,
    payload: dbPayload,
    clientIp: ctx.clientIp || null,
    userAgent: ctx.userAgent || null,
    apiKeyId: ctx.apiKeyId || null,
    apiKeyName: ctx.apiKeyName || null,
    httpMethod: ctx.httpMethod || null,
    httpPath: ctx.httpPath || null,
    statusCode: statusCode ?? null,
    durationMs: durationMs ?? null,
    requestId: ctx.requestId || sessionId,
    authMode: ctx.authMode || null,
  };
}

function createLogger(options = {}) {
  const sessionId = options.sessionId || `session-${Date.now()}`;
  const requestContext = options.requestContext || null;
  const logToConsole = options.console !== false;
  const logFilePath = path.join(LOG_DIR, options.logFile || todayLogBasename());

  if (logToFileEnabled()) {
    ensureLogDir();
  }

  function write(level, event, payload = {}) {
    const mergedContext = mergeRequestContext(requestContext, payload.requestContext);
    const record = {
      ts: new Date().toISOString(),
      level,
      event,
      sessionId,
      ...payload,
      requestContext: mergedContext,
    };

    if (logToFileEnabled()) {
      fs.appendFileSync(logFilePath, `${JSON.stringify(record)}\n`, "utf8");
    }

    if (isLogToDbEnabled()) {
      logRepository
        .insertLog(
          buildDbRecord({
            ts: record.ts,
            level,
            event,
            sessionId,
            payload,
            requestContext: mergedContext,
          })
        )
        .catch((error) => {
          if (logToConsole) {
            console.error(`[logger] DB write failed: ${error.message}`);
          }
        });
    }

    if (logToConsole) {
      const line = formatConsoleLine(level, event, payload);
      if (level === "error") {
        console.error(line);
      } else if (level === "warn") {
        console.warn(line);
      } else {
        console.log(line);
      }
    }
  }

  return {
    sessionId,
    logFilePath: logToFileEnabled() ? logFilePath : null,
    logToDb: isLogToDbEnabled(),
    logToFile: logToFileEnabled(),
    requestContext,
    info: (event, payload) => write("info", event, payload),
    warn: (event, payload) => write("warn", event, payload),
    error: (event, payload) => write("error", event, payload),
  };
}

module.exports = {
  LOG_DIR,
  logToDbEnabled: isLogToDbEnabled,
  logToFileEnabled,
  createLogger,
};
