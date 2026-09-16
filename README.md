# PDX Food Week App

A mobile-first, installable progressive web app (PWA) to browse, bookmark, plan crawls, and share your favorite dishes from Portland's themed food weeks (Pizza Week, Burger Week, Taco Week, Dumpling Week, Wing Week, and more).

## Features

- 🍕 **Browse & Filter** — Filter listings by meat, vegetarian, vegan, gluten-free, whole pie, and family-friendly. Sort by distance (GPS or ZIP code), alphabet, or neighborhood.
- 📱 **Interactive Swipe View** — Tinder-style swipe cards to quickly like/save or pass on dishes.
- ★ **Bookmark & Plan Crawls** — Save dishes across multiple food weeks. Track visited spots, organize your crawl route with integrated directions, and view metrics by neighborhood and dish type.
- 👥 **Share & Compare** — Share lists using short codes or Magic Links, load friends' lists, and instantly see common saved spots.
- 🗺️ **Map View** — Interactive Portland map with custom coordinates, neighborhood pins, and route-planning highlights.
- ⚡ **Offline & PWA Ready** — Installable on mobile and desktop devices with full offline service worker caching and automated asset hash cache-busting.
- 🔗 **OpenGraph Share Pages** — Pre-rendered individual dish preview cards with social media tags and metadata under `/d/`.

---

## Project Structure

The project is a static progressive web application with automated data scrapers and node tooling:

* **Frontend Shell**
  * [`index.html`](index.html) — Single-page application shell and view containers (`view-landing`, `view-browse`, `view-saved`, `view-share`, `view-map`).
  * [`css/style.css`](css/style.css) — Mobile-first, responsive stylesheet with desktop multi-column layouts and accessibility adjustments.
  * [`js/meta.js`](js/meta.js) — Centralized metadata registry (`window.FOOD_WEEKS`) for all supported Portland food weeks.
  * [`js/app.js`](js/app.js) — Main application controller, state management, routing, map, and view lifecycle.
  * [`js/modules/`](js/modules/) — Modular utilities including `friends.js` and `ui.js`.
  * [`sw.js`](sw.js) — Service worker handling offline caching, cache-first assets, and runtime caching.

* **Data Layer (`data/`)**
  Contains geocoded coordinates, dish details, pricing, and dietary metadata for all 2026 Portland food weeks:
  * `wienerweek2026.js` (Wiener Week)
  * `dumplingweek2026.js` (Dumpling Week)
  * `sandwichweek2026.js` (Sandwich Week)
  * `tacoweek2026.js` (Taco Week)
  * `pizzaweek2026.js` (Pizza Week)
  * `highballweek2026.js` (Highball Week)
  * `burgerweek2026.js` (Burger Week)
  * `nachoweek2026.js` (Nacho Week)
  * `wingweek2026.js` (Wing Week)
  * `friedchickenweek2026.js` (Fried Chicken Week)
  * `salads2026.js` (Salad Week)
  * `slushies2026.js` (Slushie Week)

* **Scrapers & Build Tooling (`scrapers/` & `scripts/`)**
  * `scrapers/` — Specialized scrapers for EverOut events, The Actual Portland KML sources, and geocoding utilities.
  * `scripts/hash_assets.js` — Generates deterministic asset hashes for service worker cache versioning.
  * `scripts/generate_og_pages.js` — Generates social OpenGraph preview landing pages.
  * `scripts/enrich_hours.js` — Enriches restaurant listings with operating hours.

---

## Getting Started & Local Development

No heavy build steps or bundlers are required.

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Local Server**:
   ```bash
   npm start
   ```
   Open `http://localhost:3000` (or `http://localhost:8080`) in your browser.

---

## Testing

The project includes both fast unit tests and end-to-end browser tests:

### Unit Tests (Vitest)
Validates data integrity, friend-code sharing, overlap logic, and asset hashing:
```bash
npm run test:unit
```

### End-to-End Tests (Playwright)
Simulates browser navigation, interactions, detail sheets, and filter behavior across devices:
```bash
npm run test:e2e
```

---

## Scraping & Data Generation

Scrapers extract restaurant details, dietary tags, descriptions, and coordinates into the `data/` directory:

| Command | Target Week |
| :--- | :--- |
| `npm run scrape:burgers` | Burger Week |
| `npm run scrape:pizza` | Pizza Week |
| `npm run scrape:tacos` | Taco Week |
| `npm run scrape:dumplings` | Dumpling Week |
| `npm run scrape:chicken` | Fried Chicken Week |
| `npm run scrape:nacho` | Nacho Week |
| `npm run scrape:wings` | Wing Week |
| `npm run scrape:sandwiches` | Sandwich Week |
| `npm run scrape:wieners` | Wiener Week |
| `npm run scrape:salads` | Salad Week |
| `npm run scrape:slushies` | Slushie Week |
| `npm run enrich:hours` | Operating Hours Enrichment |

---

## Adding or Updating a Food Week

1. Add the week metadata in [`js/meta.js`](js/meta.js) under `window.FOOD_WEEKS`:
   ```javascript
   {
     id: "burger-2026",
     name: "Burger Week 2026",
     organizer: "Portland Mercury",
     dataFile: "burgerweek2026.js",
     dates: "August 17–23, 2026",
     startDate: "2026-08-17",
     endDate: "2026-08-23",
     pricePills: ["$8 burgers"],
     color: "#D49E2A",
     emoji: "🍔",
     totalLocations: 50,
     url: "https://everout.com/...",
     filters: [
       { id: 'meat', label: 'Meat' },
       { id: 'vegetarian', label: 'Vegetarian' },
       { id: 'vegan', label: 'Vegan' },
       { id: 'gf', label: 'Gluten-free' }
     ]
   }
   ```
2. Place the corresponding dataset under `data/<dataFile>` (e.g. generated via the appropriate scraper).
3. Update asset hashes before deploying:
   ```bash
   npm run build
   ```

---

## Deployment

Refer to the [Deployment Guide](docs/DEPLOYMENT.md) for step-by-step instructions on deploying to GitHub Pages, Raspberry Pi, or any static web host.

