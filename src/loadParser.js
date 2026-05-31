async function loadParserModule() {
  try {
    const parser = require("hk-address-parser-lib");
    if (typeof parser.parse === "function") {
      return parser;
    }
    if (parser.default && typeof parser.default.parse === "function") {
      return parser.default;
    }
    throw new Error("Installed package does not expose a parse() function.");
  } catch (requireError) {
    try {
      const imported = await import("hk-address-parser-lib");
      if (typeof imported.parse === "function") {
        return imported;
      }
      if (imported.default && typeof imported.default.parse === "function") {
        return imported.default;
      }
      throw new Error("Installed package does not expose a parse() function.");
    } catch (importError) {
      const error = new Error(
        "Unable to load hk-address-parser-lib. Run npm install when network access to the npm registry is available."
      );
      error.cause = importError.code === "ERR_MODULE_NOT_FOUND" ? importError : requireError;
      throw error;
    }
  }
}

function getLanguageEnum(parserModule) {
  const parserAddress = parserModule.Address || {};
  return {
    zh: parserAddress.LANG_ZH || "chi",
    en: parserAddress.LANG_EN || "eng",
  };
}

module.exports = {
  loadParserModule,
  getLanguageEnum,
};
