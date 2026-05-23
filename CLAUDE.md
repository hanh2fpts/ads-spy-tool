# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies (includes Playwright Chromium download)
npm install
npx playwright install chromium

# Run the app (serves on http://localhost:3000)
npm start

# Run all tests
npm test

# Run a single test file
npx jest tests/parser.test.js

# API discovery helper (visible browser, logs API responses)
npm run discover
```

## Architecture

This is a Node.js web scraper for Google Ads Transparency Center. The backend scrapes campaign data via Playwright network interception and serves it through an Express REST API. The frontend is vanilla HTML/CSS/JS.

**Request pipeline:**

```
POST /api/scrape (advertiserId)
  → cache.js: check cache/
  → scraper.js: headless Chromium, intercept network responses
  → parser.js: transform raw creativeGroups[] into campaign objects
  → cache.js: write cache/{advertiserId}.json (1-hour TTL)
  → JSON response to frontend
```

**Key files:**
- [src/scraper.js](src/scraper.js) — Playwright automation; matches API responses with regex `AdsTTransparencyCenterUi|advertiser.*creative|transparency.*batch`; if no matching response is intercepted within 30s, throws `'NO_DATA'`
- [src/parser.js](src/parser.js) — Transforms `creativeGroups` array; `isActive` is true when `lastShownDate == null`; maps format codes (DISPLAY, SEARCH, VIDEO, SHOPPING) to readable names
- [src/server.js](src/server.js) — Two routes: `POST /api/scrape` and `GET /api/export` (CSV); validates advertiser IDs against `^AR\d+$`
- [src/cache.js](src/cache.js) — File-based cache in `cache/` directory; stores `{ data, cachedAt }` JSON; TTL is 3,600,000 ms
- [public/app.js](public/app.js) — Manages 4 UI states (input, loading, cards, table); client-side CSV generation; `esc()` helper escapes HTML to prevent XSS

**Frontend** is served as static files from `public/` by Express — no build step required.

## API

| Endpoint | Method | Input | Output |
|----------|--------|-------|--------|
| `/api/scrape` | POST | `{ advertiserId }` | `{ campaigns[], fromCache }` |
| `/api/export` | GET | `?advertiserId=AR...` | CSV file (from cache only) |

Error codes: `400` for invalid ID format, `502` for scrape failure.

## Google API Dependency

The scraper intercepts Google's internal ATC API responses. If Google changes their endpoints, update the regex pattern in [src/scraper.js](src/scraper.js). Use `npm run discover` ([discover.js](discover.js)) to identify the new endpoint — it launches a visible browser and logs all JSON responses with previews.
