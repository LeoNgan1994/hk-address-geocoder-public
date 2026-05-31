# Architecture (public)

## Overview

```
Client → Express API → geocodeService → geocodeRouter → Provider
                                              ↓
                                    government_address (LandsD)
                                    lamp_post_registry (LandsD LPPUN)
```

## Address pipeline

1. **Extract** — `locationExtractor` normalizes text, extracts street/doorplate/building cues, lamp post IDs, and candidate geocode queries.
2. **Route** — `ruleClassifier` picks primary provider (address vs lamp post).
3. **Resolve address** — `governmentAddressApiClient` uses street-first LandsD search via `landsdRecordPicker` (doorplate search → building keyword filter → fallback queries).
4. **Resolve lamp post** — `lampPostLandsdClient` calls LandsD UN SearchNumber API.
5. **Format** — WGS84 + optional HK1980 grid in API response.

## Cache (optional)

When `DATABASE_URL` is set and `CACHE_ENABLED=true`, results are stored in PostgreSQL `geocode_cache` with semantic keys (`addr:`, `lamp:`, etc.).

## Demo config

`GET /demo/config.json` exposes branding and enabled query modes from environment variables — no rebuild required to customize the demo page.

## Adding a new public data source

1. Register in `src/config/dataSources.js`
2. Add provider under `src/providers/`
3. Wire API handler in `src/middleware/adapters/apiAdapter.js`
4. Update classifier routing if needed
5. Expose via `/api/v1/capabilities`

Keep internal-only sources out of this public repository.
