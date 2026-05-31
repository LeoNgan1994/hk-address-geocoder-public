# API (public)

Base URL: `http://localhost:3000` (or your deployment host).

## Authentication

By default **`ENABLE_API_KEY=false`** — no key required.

To enable auth, set in `.env`:

```env
ENABLE_API_KEY=true
ADMIN_API_KEY=your-secret-key
```

Send the key as:

- Header `X-API-Key: your-secret-key`, or
- Header `Authorization: Bearer your-secret-key`

When enabled, admin key holders can access `/api-docs` and `/api/v1/admin/keys` (requires PostgreSQL for client key storage).

## Endpoints

| Path | Method | Auth | Description |
|------|--------|------|-------------|
| `/api/v1/resolve` | POST | Optional | Resolve address or lamp post text |
| `/api/v1/capabilities` | GET | Optional | Enabled modules and data sources |
| `/health` | GET | No | Liveness |
| `/ready` | GET | No | Readiness |
| `/demo` | GET | No | Browser demo |
| `/demo/config.json` | GET | No | Demo branding and UI flags |

## Resolve request

```json
POST /api/v1/resolve
Content-Type: application/json

{
  "text": "尖沙咀廣東道5號海洋中心",
  "useCache": true
}
```

### Success response (200)

```json
{
  "input": "尖沙咀廣東道5號海洋中心",
  "status": "success",
  "coordinate": { "lat": 22.296056, "lng": 114.16882 },
  "coordinates": {
    "wgs84": { "crs": "EPSG:4326", "lat": 22.296056, "lng": 114.16882 },
    "hk1980": { "crs": "EPSG:2326", "x": 836123.456, "y": 815890.123 }
  },
  "provider": "landsD",
  "geocodeQuery": "尖沙咀廣東道5號海洋中心",
  "matchedAddressZh": "…",
  "matchedAddressEn": "…"
}
```

### Error responses

| HTTP | error | Meaning |
|------|-------|---------|
| 400 | validation | Invalid or empty input |
| 401 | unauthorized | Missing or invalid API key |
| 422 | no_coordinate | Parsed but no coordinates found |
| 502 | upstream_failed | Government API failure |
| 429 | rate_limit_exceeded | Daily or per-minute limit |

## Rate limits

When `RATE_LIMIT_ENABLED=true` (default), anonymous clients share env defaults (`RATE_LIMIT_DAILY`, `RATE_LIMIT_PER_MINUTE`).

## OpenAPI

Specification: [openapi.yaml](./openapi.yaml)  
When running locally with admin key auth: http://localhost:3000/api-docs
