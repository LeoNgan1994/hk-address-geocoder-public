const crypto = require("crypto");

function getMaxInputLength() {
  const n = Number(process.env.MAX_INPUT_LENGTH || 2048);
  return Number.isFinite(n) && n > 0 ? n : 2048;
}

function getLogAddressMode() {
  const mode = (process.env.LOG_ADDRESS_MODE || "truncate").toLowerCase();
  if (mode === "full" || mode === "hash" || mode === "truncate") {
    return mode;
  }
  return "truncate";
}

function getLogAddressMaxLength() {
  const n = Number(process.env.LOG_ADDRESS_MAX_LENGTH || 200);
  return Number.isFinite(n) && n > 0 ? n : 200;
}

function sanitizeAddressForLog(address) {
  if (address == null || address === "") {
    return null;
  }
  const text = String(address);
  const mode = getLogAddressMode();

  if (mode === "full") {
    return text;
  }
  if (mode === "hash") {
    const digest = crypto.createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
    return `[sha256:${digest}] len=${text.length}`;
  }

  const maxLen = getLogAddressMaxLength();
  if (text.length <= maxLen) {
    return text;
  }
  return `${text.slice(0, maxLen)}…[+${text.length - maxLen} chars]`;
}

function validateInputText(text, fieldName = "text") {
  if (!text || typeof text !== "string") {
    return {
      ok: false,
      error: "invalid_request",
      message: `請提供 ${fieldName} 欄位（字串）`,
      source: "client",
    };
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: "invalid_request",
      message: `${fieldName} 不可為空白`,
      source: "client",
    };
  }
  const maxLen = getMaxInputLength();
  if (trimmed.length > maxLen) {
    return {
      ok: false,
      error: "invalid_request",
      message: `${fieldName} 超過長度上限（${maxLen} 字元）`,
      source: "client",
      details: { maxLength: maxLen, actualLength: trimmed.length },
    };
  }
  return { ok: true, value: trimmed };
}

module.exports = {
  getMaxInputLength,
  getLogAddressMode,
  sanitizeAddressForLog,
  validateInputText,
};
