# Codebase Audit & Improvement Roadmap

A comprehensive review of the **PDX Food Week** application across performance, architecture, UX/UI design, and feature enhancements.

---

## 1. Performance & Codebase Efficiency

### ⚡ Dynamic / Lazy Data Loading
* **Current State:** `index.html` loads 7 separate data files synchronously via script tags (`burgerweek2026.js`, `salads2026.js`, `slushies2026.js`, `nachoweek2026.js`, `pizzaweek2026.js`, `highballweek2026.js`, `tacoweek2026.js`).
* **Impact:** Loads ~250KB of uncompressed JavaScript data on initial page load, parsing hundreds of unused dish objects before the user chooses a food week.
* **Suggestion:** Implement dynamic `import()` or lazy script injection for datasets:
  ```javascript
  async function loadWeekData(weekId) {
    if (!loadedWeeks.has(weekId)) {
      await import(`./data/${weekFileMap[weekId]}`);
      loadedWeeks.add(weekId);
    }
  }
  ```
  This reduces initial page load size by over 70% and enables instant startup on mobile connections.

### 📦 Modularize `js/app.js` (3,200+ lines)
* **Current State:** `js/app.js` is a monolithic file containing state management, view controllers (Browse, Swipe, Saved, Share, Map), filtering, geocoding, modal logic, and event listeners.
* **Suggestion:** Split into decoupled ES modules:
  - `src/state.js` — App state, localStorage persistence, week switching
  - `src/views/browse.js` — Card rendering, search, filter chip logic
  - `src/views/swipe.js` — Swipe deck stack, gestures, animations
  - `src/views/map.js` — Leaflet cluster management & map controls
  - `src/views/saved.js` — Saved list reordering, ratings, and notes
  - `src/components/detailSheet.js` — Slide-up detail sheet & photo zoom

### 🗺️ Leaflet Map Marker Reuse
* **Current State:** Toggling filters completely tears down the Leaflet map instance and markers (`leafletMap.remove()`), recreating all DOM cluster nodes from scratch.
* **Suggestion:** Retain the Leaflet map instance and update marker visibility via `markerClusterGroup.clearLayers()` and adding filtered markers, eliminating map canvas re-render jank.

---

## 2. UX/UI & Aesthetic Enhancements

### 🎨 Active Filter Counter Badge on Mobile FAB
* **Current State:** Tapping the mobile floating filter button (`#mobile-filter-fab`) opens the staged filter drawer, but when closed, users cannot see how many filters are currently active.
* **Suggestion:** Add an active filter counter badge to the mobile FAB (e.g. `Filter (2)`) and highlight the button in the active theme color when 1+ filters are applied.

### 📱 Enhanced Swipe Deck Micro-Interactions
* **Current State:** Cards in the Swipe tab slide left/right on drag.
* **Suggestion:**
  - **Stack Visual Depth:** Scale second and third background cards in the stack (`transform: scale(0.95) translateY(12px)`), animating smoothly into position when top card is swiped.
  - **Haptic Feedback:** Trigger subtle vibration (`navigator.vibrate(15)`) when a swipe gesture completes on mobile.
  - **Action Button Row:** Add floating action buttons underneath the card stack (✕ Pass, ❤️ Save, ℹ️ Info) for single-tap interaction without swiping.

### 🔍 Search Highlighting & Instant Debounce
* **Current State:** Search input filters list instantly on input events.
* **Suggestion:** Wrap matching search terms in `<mark class="search-highlight">` in dish titles and restaurant names, and debounce search input by 150ms to prevent rapid DOM thrashing during typing.

---

## 3. Feature Enhancements

### 🗺️ Food Crawl Route & Itinerary Planner
* **Feature Concept:** A "Build a Crawl" feature for saved items.
* **How It Works:**
  1. Users select 3–5 saved spots in a neighborhood.
  2. The app calculates the shortest walking or driving route using GPS/geocodes.
  3. Displays a step-by-step itinerary with distance, walking time, and single-click turn-by-turn navigation in Google Maps / Apple Maps.

### 📲 Progressive Web App (PWA) & Offline Mode
* **Feature Concept:** Add a Service Worker (`sw.js`) and Web App Manifest.
* **Benefit:** Allows users out in Portland neighborhoods (where cellular signal in basement bars or crowded festival venues can be spotty) to view saved dishes, addresses, and maps 100% offline.

### 📤 Google Maps List / KML Export
* **Feature Concept:** Allow users to export their saved dishes directly into a Google Maps Saved List URL or KML file, enabling direct integration into Google Maps.

### 📊 Neighborhood & Category Quick Stats
* **Feature Concept:** A quick collapsible stats bar above the browse grid showing:
  - Total Spots (`117`)
  - Quadrant Breakdown (`SE: 45`, `NE: 32`, `NW: 20`, `SW: 15`, `Suburbs: 5`)
  - Dietary Breakdown (`Vegan: 14`, `Vegetarian: 28`, `Gluten-Free: 18`)
