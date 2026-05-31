function isApiKeyEnabled() {
  const raw = process.env.ENABLE_API_KEY;
  if (raw === undefined || raw === "") {
    return false;
  }
  return raw === "true" || raw === "1";
}

function getAdminApiKey() {
  return process.env.ADMIN_API_KEY || "";
}

module.exports = {
  isApiKeyEnabled,
  getAdminApiKey,
};
