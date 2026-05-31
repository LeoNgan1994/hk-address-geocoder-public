const express = require("express");
const { runDatabaseOp } = require("../../db/dbSafe");
const { isApiKeyEnabled } = require("../../auth/apiKeyConfig");
const { parseQuotaFields, getDefaultDailyQuota, getDefaultPerMinuteQuota } = require("../../auth/quotaConfig");
const {
  createClientKey,
  listClientKeys,
  updateClientKey,
  getClientKey,
  revokeClientKey,
} = require("../../auth/apiKeyService");
const { adminAuth } = require("../middleware/apiKeyAuth");
const { getUsageForAuthKey } = require("../middleware/rateLimit");
const { ApiError } = require("../errors");
const { asyncHandler } = require("../errors");

function createAdminKeysRouter() {
  const router = express.Router();

  router.use(adminAuth);

  router.get(
    "/",
    asyncHandler(async (_req, res) => {
      const keys = await runDatabaseOp(() => listClientKeys(getUsageForAuthKey));
      return res.json({
        enableApiKey: isApiKeyEnabled(),
        defaults: {
          dailyQuota: getDefaultDailyQuota(),
          rateLimitPerMinute: getDefaultPerMinuteQuota(),
        },
        keys,
      });
    })
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const key = await runDatabaseOp(() => getClientKey(req.params.id, getUsageForAuthKey));
      if (!key) {
        throw new ApiError(404, "not_found", "找不到此 API Key", "client");
      }
      return res.json({ key });
    })
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const name = req.body?.name;
      const description = req.body?.description || null;
      const expiresAt = req.body?.expiresAt || null;
      const quotaParsed = parseQuotaFields(req.body);
      if (!quotaParsed.ok) {
        throw new ApiError(400, "invalid_request", quotaParsed.message, "client");
      }

      if (!name || typeof name !== "string" || !name.trim()) {
        throw new ApiError(400, "invalid_request", "請提供 name（字串）", "client");
      }

      const created = await runDatabaseOp(() =>
        createClientKey({
          name: name.trim(),
          description: typeof description === "string" ? description.trim() : null,
          expiresAt: expiresAt || null,
          createdBy: req.auth.keyName,
          dailyQuota: quotaParsed.dailyQuota,
          rateLimitPerMinute: quotaParsed.rateLimitPerMinute,
        })
      );

      return res.status(201).json({
        key: created.record,
        apiKey: created.apiKey,
        message: "API Key 只會顯示這一次，請妥善保存",
      });
    })
  );

  router.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const quotaParsed = parseQuotaFields(req.body);
      if (!quotaParsed.ok) {
        throw new ApiError(400, "invalid_request", quotaParsed.message, "client");
      }

      const patch = {};
      if (typeof req.body?.enabled === "boolean") {
        patch.enabled = req.body.enabled;
      }
      if (quotaParsed.dailyQuota !== undefined) {
        patch.dailyQuota = quotaParsed.dailyQuota;
      }
      if (quotaParsed.rateLimitPerMinute !== undefined) {
        patch.rateLimitPerMinute = quotaParsed.rateLimitPerMinute;
      }

      if (Object.keys(patch).length === 0) {
        throw new ApiError(
          400,
          "invalid_request",
          "請提供 enabled、dailyQuota 和／或 rateLimitPerMinute",
          "client"
        );
      }

      const updated = await runDatabaseOp(() => updateClientKey(req.params.id, patch));
      if (!updated) {
        throw new ApiError(404, "not_found", "找不到此 API Key", "client");
      }

      return res.json({ key: updated });
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const revoked = await runDatabaseOp(() => revokeClientKey(req.params.id));
      if (!revoked) {
        throw new ApiError(404, "not_found", "找不到此 API Key", "client");
      }

      return res.json(revoked);
    })
  );

  return router;
}

module.exports = {
  createAdminKeysRouter,
};
