require("./loadEnv").loadEnv();
const path = require("path");
const express = require("express");
const swaggerUi = require("swagger-ui-express");
const { bootstrap } = require("./bootstrap");
const { geocodeAddress } = require("./geocodeService");
const { createLogger } = require("./logger");
const { isApiKeyEnabled } = require("./auth/apiKeyConfig");
const { closePool } = require("./db/client");
const { createV1Router } = require("./api/routes/v1");
const { formatResolveResponse } = require("./api/formatResolveResponse");
const { apiKeyAuth, adminAuth } = require("./api/middleware/apiKeyAuth");
const { attachRequestContext } = require("./api/requestContext");
const { accessLogMiddleware } = require("./api/middleware/accessLog");
const { requestTimeoutMiddleware } = require("./api/middleware/requestTimeout");
const { rateLimitMiddleware } = require("./api/middleware/rateLimit");
const { responseHeadersMiddleware } = require("./api/middleware/responseHeaders");
const { notFoundHandler, globalErrorHandler } = require("./api/middleware/globalErrorHandler");
const { asyncHandler, formatErrorBody } = require("./api/errors");
const { buildResolveHttpOutcome, buildInternalGeocodeHttpOutcome } = require("./api/resolveHttpOutcome");
const { validateInputText } = require("./lib/logSanitize");
const { checkReadiness } = require("./health/readiness");
const { buildDemoConfig } = require("./api/demoConfig");
const { getEnvLimits, isRateLimitEnabled } = require("./api/middleware/rateLimit");

const PORT = Number(process.env.PORT || 3000);
const OPENAPI_PATH = path.join(__dirname, "..", "docs", "openapi.yaml");

async function start() {
  const boot = await bootstrap();
  console.log(
    JSON.stringify({
      event: "bootstrap_complete",
      outboundProxy: process.env._OUTBOUND_PROXY_CONFIGURED || null,
      httpProxy: process.env.HTTP_PROXY || null,
      ...boot,
    })
  );

  const app = express();
  app.set("trust proxy", true);
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "address-coordinate-convert",
    });
  });

  app.get(
    "/ready",
    asyncHandler(async (_req, res) => {
      const readiness = await checkReadiness();
      const statusCode = readiness.status === "ready" ? 200 : 503;
      return res.status(statusCode).json(readiness);
    })
  );

  app.get("/openapi.yaml", adminAuth, (_req, res) => {
    res.type("application/yaml").sendFile(OPENAPI_PATH);
  });

  app.use(
    "/api-docs",
    adminAuth,
    swaggerUi.serve,
    swaggerUi.setup(null, {
      customSiteTitle: "Address Coordinate Convert API",
      swaggerOptions: { url: "/openapi.yaml" },
    })
  );

  app.use("/api/v1", createV1Router());

  const demoDir = path.join(__dirname, "..", "public", "demo");
  app.get(
    "/demo/config.json",
    asyncHandler(async (_req, res) => {
      res.json(await buildDemoConfig());
    })
  );
  app.use("/demo", express.static(demoDir));
  app.get("/demo", (_req, res) => {
    res.sendFile(path.join(demoDir, "index.html"));
  });

  /** Internal full payload — maintenance / debugging */
  app.post(
    "/api/geocode",
    attachRequestContext,
    responseHeadersMiddleware,
    requestTimeoutMiddleware,
    accessLogMiddleware,
    apiKeyAuth,
    rateLimitMiddleware,
    asyncHandler(async (req, res) => {
      const rawText = req.body?.address ?? req.body?.text;
      const validated = validateInputText(rawText, "address 或 text");
      if (!validated.ok) {
        return res.status(400).json(formatErrorBody(req, validated));
      }

      const useCache = req.body?.useCache !== false;
      const format = req.query.format || req.body?.format;
      const includeDetail = req.query.detail === "1" || req.body?.detail === true;

      const logger = createLogger({
        sessionId: req.requestContext?.requestId || `api-${Date.now()}`,
        requestContext: req.requestContext,
      });

      const result = await geocodeAddress(validated.value, { useCache, logger });

      if (format === "resolve") {
        const payload = formatResolveResponse(result, validated.value, { includeDetail });
        const outcome = buildResolveHttpOutcome(result, payload);
        if (outcome.status === 200) {
          return res.status(200).json({
            ...outcome.body,
            requestId: req.requestContext?.requestId,
          });
        }
        return res.status(outcome.status).json({
          ...formatErrorBody(req, outcome),
          input: validated.value,
        });
      }

      const internalOutcome = buildInternalGeocodeHttpOutcome(result);
      return res.status(internalOutcome.status).json({
        ...internalOutcome.body,
        requestId: req.requestContext?.requestId,
      });
    })
  );

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  const server = app.listen(PORT, () => {
    const limits = getEnvLimits();
    console.log(`Geocode API listening on port ${PORT}`);
    console.log(`Public API:    POST http://localhost:${PORT}/api/v1/resolve`);
    console.log(`Demo UI:       http://localhost:${PORT}/demo`);
    console.log(`Internal API:  POST http://localhost:${PORT}/api/geocode`);
    console.log(`API docs:      http://localhost:${PORT}/api-docs (admin key)`);
    console.log(`API key gate:  ${isApiKeyEnabled() ? "enabled" : "disabled (open)"}`);
    if (isRateLimitEnabled()) {
      console.log(`Rate limit:    ${limits.daily}/day, ${limits.perMinute}/minute per key`);
    }
  });

  const shutdown = async () => {
    server.close();
    await closePool();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
