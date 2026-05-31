# HK Address Geocoder (Public)

Open-source Hong Kong **address** and **lamp post** geocoding service.

Resolve free-text input (Chinese or English addresses, ECC-style case text, or lamp post IDs such as `GD3840`) to coordinates using public government APIs (Lands Department / map.gov.hk). Includes a small browser demo and a JSON API.

> **Note:** This public repository intentionally does **not** include internal-only data sources or deployment details. A separate private deployment may add additional providers.

## Features

- **Address geocoding** — street-first matching against LandsD location search, with building-name filtering and fallback queries
- **Lamp post lookup** — LandsD LPPUN SearchNumber API
- **Dual coordinates** — WGS84 (EPSG:4326) and HK1980 grid (EPSG:2326) when available
- **Optional PostgreSQL** — result cache and request logs (disabled by default)
- **Browser demo** — map, result panel, copy coordinates button
- **Configurable demo branding** — title, subtitle, credit line via environment variables

## Quick start (no database)

```bash
git clone https://github.com/LeoNgan1994/hk-address-geocoder-public.git
cd hk-address-geocoder-public
cp .env.example .env
npm install
npm start
```

Open:

| URL | Description |
|-----|-------------|
| http://localhost:3000/demo | Interactive demo |
| http://localhost:3000/health | Liveness check |
| http://localhost:3000/api/v1/capabilities | Enabled modules |

### Try the API

```bash
curl -s http://localhost:3000/api/v1/resolve \
  -H 'Content-Type: application/json' \
  -d '{"text":"尖沙咀廣東道5號海洋中心","useCache":false}' | jq .
```

With API key auth enabled (`ENABLE_API_KEY=true`):

```bash
curl -s http://localhost:3000/api/v1/resolve \
  -H 'Content-Type: application/json' \
  -H "X-API-Key: $ADMIN_API_KEY" \
  -d '{"text":"燈柱 GD3840","useCache":false}' | jq .
```

## Configuration

Copy `.env.example` to `.env`. Important settings:

| Variable | Default (public) | Purpose |
|----------|------------------|---------|
| `DATABASE_URL` | *(empty)* | PostgreSQL; leave empty for stateless mode |
| `CACHE_ENABLED` | `false` | Result cache (requires DB) |
| `ENABLE_API_KEY` | `false` | Require `X-API-Key` header |
| `LAMP_POST_LANDSD_ENABLED` | `true` | Enable lamp post module |
| `DEMO_*` | see `.env.example` | Demo page branding |

Demo UI reads `GET /demo/config.json` on load (branding, enabled query modes, whether API key is required).

## API overview

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/resolve` | Resolve text → coordinates (public response shape) |
| `GET` | `/api/v1/capabilities` | List enabled modules |
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness (database if configured) |

See [docs/API.md](docs/API.md) and [docs/openapi.yaml](docs/openapi.yaml) for details.

## Development

```bash
npm run test:extract      # Address extraction unit tests
npm run test:landsd       # LandsD record picker tests
npm run test:coordinates  # Sample address batch test
npm run test:public-provider
```

## Data sources (public)

| Module | API | Notes |
|--------|-----|-------|
| Government address | [map.gov.hk](https://www.map.gov.hk) LandsD location search | Primary path for street/building addresses |
| Lamp post | [mapapi.geodata.gov.hk](https://mapapi.geodata.gov.hk) LPPUN | Public lamp post IDs |

Coordinates from LandsD are returned in HK1980 grid and converted to WGS84.

## Optional PostgreSQL

To enable caching and DB-backed logs:

```bash
# Example local Postgres
DATABASE_URL=postgres://geocode:geocode@localhost:5432/geocode
CACHE_ENABLED=true
LOG_TO_DB=true
```

Apply schema from `db/schema.sql` (or let the app run migrations on startup when `DATABASE_URL` is set).

## Project layout

```
src/
  extractor/          # Address & asset ID extraction from free text
  clients/            # LandsD / lamp post API clients
  router/             # Provider routing
  api/                # HTTP API (v1 resolve, capabilities, demo config)
public/demo/          # Static demo UI
docs/                 # API and architecture notes
```

## License

MIT — see [LICENSE](LICENSE).

## Author

Leo Ngan — public demo and maintenance.
