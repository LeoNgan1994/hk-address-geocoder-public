const crypto = require("crypto");

function hashApiKey(apiKey) {
  return crypto.createHash("sha256").update(String(apiKey), "utf8").digest("hex");
}

function generateApiKey() {
  const secret = crypto.randomBytes(16).toString("hex");
  return `acc_${secret}`;
}

function keyPrefix(apiKey) {
  return String(apiKey).slice(0, 12);
}

function secureCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  hashApiKey,
  generateApiKey,
  keyPrefix,
  secureCompare,
};
