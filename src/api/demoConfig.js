function readEnv(name, fallback = "") {
  const value = process.env[name];
  return value === undefined || value === null || value === "" ? fallback : value;
}

function parseQueryModes() {
  const raw = readEnv("DEMO_QUERY_MODES", "auto,lamp");
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildDemoConfig() {
  return {
    branding: {
      eyebrow: readEnv("DEMO_EYEBROW", "Leo Ngan"),
      title: readEnv("DEMO_TITLE", "HK Address Geocoder"),
      subtitle: readEnv(
        "DEMO_SUBTITLE",
        "Hong Kong address and lamp post coordinate lookup demo"
      ),
      credit: readEnv("DEMO_CREDIT", "Powered by Leo Ngan"),
      mascotUrl: readEnv("DEMO_MASCOT_URL", ""),
    },
    queryModes: parseQueryModes(),
    providers: {
      address: true,
      lampPost: process.env.LAMP_POST_LANDSD_ENABLED !== "false",
    },
    apiKeyRequired: process.env.ENABLE_API_KEY === "true" || process.env.ENABLE_API_KEY === "1",
  };
}

module.exports = {
  buildDemoConfig,
};
