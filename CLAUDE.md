# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` — install scraper deps (`cheerio`, `node-fetch`). Only needed before running the Node scraper.
- `npm run scrape` — run `scrape.js` (Node, ESM). Fetches the EverOut Pizza Week index, scrapes each sub-event page, geocodes via Nominatim, and overwrites `data/pizzaweek2026.js`.
- Local preview: `python3 -m http.server 8080` from repo root, then open `http://localhost:8080`. No build step — static site.

No test suite, no linter, no bundler. Edits to `index.html`, `css/style.css`, `js/app.js`, or `data/*.js` are live on reload.

## Architecture

Static vanilla-JS single-page app. Three layers that talk via `window` globals — no module system in the browser.

**Data layer (`data/pizzaweek2026.js`)** — script-tag loaded before `app.js`. Exposes two globals: `window.FOOD_WEEKS` (array of week metadata) and `window.RESTAURANTS` (array of dish entries, each tagged with `weekId`). The file is generated/overwritten by the scraper; hand-edits get wiped on next `npm run scrape`.

**App layer (`js/app.js`)** — one IIFE-wrapped `App` module. All state (active tab, filter, search, saved set, friends, selected dish, `currentWeekId`) lives in closure vars. Persistence is `localStorage` under `pdxfw_saved_v1` and `pdxfw_friends_v1`. Multi-week switching is implemented at the data level (`getRestaurants()` filters by `currentWeekId`) but the UI switcher is a placeholder — adding a new week means adding a `<script src="data/...">` to `index.html` before `app.js` and wiring a chooser.

**View layer (`index.html` + `css/style.css`)** — four tab-panel sections (`view-browse`, `view-saved`, `view-friends`, `view-map`) plus a bottom-sheet detail overlay and a toast. Event wiring is inline `onclick="App.*"` on buttons/cards; `App.init` only wires overlay-close, search input, and friend-code Enter key. Responsive breakpoints: 768px (tablet), 1100px (desktop sidebar layout), 1400px (wide).

**Share codes** — `encodeShareCode()` / `decodeShareCode()` in `app.js`: sorted saved IDs joined by `,`, base64'd (padding stripped), prefixed `PDX26-`. Changing the format breaks every previously-shared code.

**Map** — `renderMap()` draws a hand-rolled canvas projection of Portland (not Leaflet/Mapbox). Pins are hit-tested on click via stored `r._mapX/_mapY` on each restaurant object. Willamette River is a hardcoded bezier.

## Scrapers

Two scrapers exist for the same source (EverOut), pick based on environment:

- **`scrape.js`** (Node, run via `npm run scrape`) — writes `data/pizzaweek2026.js` directly. Rate-limited (~800ms between dish pages, ~1100ms for Nominatim geocoding — Nominatim enforces 1 req/sec). Addresses that fail to geocode default to downtown PDX (`45.5231, -122.6765`) — scan output for that coord pair and fix manually.
- **`scrape-console.js`** (browser console) — paste into DevTools on the EverOut week page. Uses `fetch` with same-origin cookies, extracts coords from embedded Google Maps links instead of geocoding, triggers a file download. Use when the Node scraper is blocked or when you already have the page open.

Both use loose keyword matching (`text.includes('vegan')`, etc.) for dietary tags — review the output. Restaurant-name parsing strips `(Neighborhood)` parens into the `neighborhood` field.

## Deployment

Target is GitHub Pages (root of `main`) or any static host / Raspberry Pi. The `index.html` loads `data/*.js` via relative `<script>` tags, so the whole repo must be served as-is — don't move files into subdirs without updating the tags.
