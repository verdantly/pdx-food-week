# PDX Food Week App

A mobile-first web app to browse, bookmark, and share your favorite dishes from Portland's themed food weeks (Pizza Week, Burger Week, etc.).

## Features

- 🍕 **Browse** — filter by meat/veg/vegan, gluten-free, whole pie, family-friendly
- ★ **Bookmark** — save dishes you want to try; persists in browser storage
- 👥 **Share** — share a short code, paste friends' codes, see overlap
- 🗺️ **Map** — tap pins to see details; saved spots highlighted

---

## Project Structure

The project is structured as a simple static web application with automated data scrapers:

* **Core Frontend Layer**
  * [index.html](file:///q:/My%20Drive/GitHub/pdx-food-week/pdx-food-week/index.html) — The main single-page application shell.
  * [css/style.css](file:///q:/My%20Drive/GitHub/pdx-food-week/pdx-food-week/css/style.css) — Custom visual stylesheet (responsive, mobile-first, and accessibility-optimized).
  * [js/app.js](file:///q:/My%20Drive/GitHub/pdx-food-week/pdx-food-week/js/app.js) — Core frontend logic (views, state, swipe tab, filtering, Leaflet map configuration).

* **Data Layer**
  * [data/tacoweek2026.js](file:///q:/My%20Drive/GitHub/pdx-food-week/pdx-food-week/data/tacoweek2026.js) — Taco Week 2026 listings, geocoded coordinates, and metadata (scraped, default view).
  * [data/pizzaweek2026.js](file:///q:/My%20Drive/GitHub/pdx-food-week/pdx-food-week/data/pizzaweek2026.js) — Pizza Week 2026 listings and metadata (scraped).
  * [data/highballweek2026.js](file:///q:/My%20Drive/GitHub/pdx-food-week/pdx-food-week/data/highballweek2026.js) — Highball Week 2026 listings and metadata (scraped).

* **Scrapers and Tooling**
  * [scrape_tacos.js](file:///q:/My%20Drive/GitHub/pdx-food-week/pdx-food-week/scrape_tacos.js) — Scraper for Taco Week (parses KML, matches Squarespace JSON, reverse-geocodes with local cache).
  * [scrape_everout.js](file:///q:/My%20Drive/GitHub/pdx-food-week/pdx-food-week/scrape_everout.js) — Automated scraper and geocoder for EverOut-hosted food weeks.
  * [scrape-console.js](file:///q:/My%20Drive/GitHub/pdx-food-week/pdx-food-week/scrape-console.js) — Browser console fallback utility scraper for EverOut.

---

## Deployment

Refer to the [DEPLOYMENT.md](file:///q:/My%20Drive/GitHub/pdx-food-week/pdx-food-week/DEPLOYMENT.md) guide for details on deploying the application to GitHub Pages, Raspberry Pi (local network), or other hosting servers.

---

## Adding Data for New Food Weeks

1. Create a data file under `data/` (e.g. `data/burgerweek2026.js`) containing the week's details.
2. In the new data file, define your week in the `window.FOOD_WEEKS` array:
   ```js
   window.FOOD_WEEKS.push({
     id: "burger-2026",
     name: "Burger Week 2026",
     dates: "August 10–16",
     pricePills: ["$8 burger"],
     totalLocations: 50,
     emoji: "🍔",
     color: "#D49E2A"
   });
   ```
3. Populate `window.RESTAURANTS` with the dish entries, ensuring `weekId` matches (e.g. `"burger-2026"`).
4. In `index.html`, load the new script tag **before** `js/app.js`:
   ```html
   <script src="data/burgerweek2026.js"></script>
   ```
5. Add the new option to the `<select id="week-switcher">` dropdown in `index.html`:
   ```html
   <option value="burger-2026">🍔 Burger Week</option>
   ```
6. Set the default active week `currentWeekId` in `js/app.js` if you want it to load by default.

## Restaurant Data Fields

```js
{
  id: 1,                        // unique integer
  weekId: "pizza-2026",         // matches FOOD_WEEKS id
  dish: "Dish Name",            // the special item name
  restaurant: "Restaurant Name",
  neighborhood: "Pearl District",
  address: "123 NW Example St, Portland, OR 97209",
  lat: 45.5272,                 // for map (decimal degrees)
  lng: -122.6843,
  type: "meat",                 // "meat" | "vegetarian" | "vegan"
  glutenFree: false,            // true if GF option available
  wholePie: false,              // true if $25 whole pie offered (Pizza Week specific)
  minors: true,                 // true if minors allowed / Family OK
  takeout: true,                // true if takeout available
  desc: "Short description of the dish.",
  emoji: "🍕",                  // display emoji
  url: "https://everout.com/..." // link to EverOut listing
}
```

---

## Scraping and Data Generation

Instead of compiling restaurant data manually, you can use the automated scrapers included in this repository to fetch food week events:

### 1. EverOut Food Weeks (e.g. Pizza Week) — `scrape_everout.js`
Requires Node.js environment. It automatically fetches listings from EverOut, parses details/dietary flags, geocodes addresses using Nominatim, and outputs the completed JS file.
```bash
# Install dependencies
npm install

# Run the EverOut scraper
npm run scrape:everout
```

### 2. Taco Week (hosted on The Actual Portland) — `scrape_tacos.js`
Uses Node.js to parse the Taco Week KML coordinates and Squarespace JSON context, matches items, applies geocoding with local caching (`data/geocode_cache.json`), and outputs the completed JS file.
```bash
# Run the Taco Week scraper
npm run scrape:tacos
```

### 3. Browser Console Scraper (`scrape-console.js`)
If you are running in a restricted sandbox or get rate-limited during geocoding on EverOut, open the EverOut food week index page in your browser DevTools, paste the contents of `scrape-console.js` into the console, and hit enter. It extracts coordinates directly from Google Maps links inside the page and prompts a file download.
